"""Our own GPT, written from scratch: no pretrained weights anywhere.

A decoder-only transformer with the building blocks of today's open models:
RMSNorm, rotary positions (RoPE), SwiGLU feed-forward layers and tied input/output
embeddings. Includes a key/value cache so answers can be generated one token at a time.
"""
import math
from dataclasses import asdict, dataclass

import torch
import torch.nn as nn
import torch.nn.functional as F


@dataclass
class Config:
    vocab_size: int = 16384
    d_model: int = 768
    n_layer: int = 12
    n_head: int = 12
    max_seq: int = 1024
    ffn_mult: float = 8 / 3
    rope_base: float = 10000.0

    @property
    def head_dim(self):
        return self.d_model // self.n_head

    @property
    def ffn_hidden(self):
        h = int(self.ffn_mult * self.d_model)
        return 64 * ((h + 63) // 64)


# Sizes used in the plan. Parameter counts depend a little on the vocabulary size.
PRESETS = {
    "tiny": dict(d_model=128, n_layer=4, n_head=4),     # smoke tests
    "15m": dict(d_model=384, n_layer=8, n_head=6),      # Stage 1 laptop prototype
    "50m": dict(d_model=576, n_layer=12, n_head=9),
    "100m": dict(d_model=768, n_layer=12, n_head=12),   # Stage 2 reasoning model
}


class RMSNorm(nn.Module):
    def __init__(self, dim, eps=1e-6):
        super().__init__()
        self.eps = eps
        self.weight = nn.Parameter(torch.ones(dim))

    def forward(self, x):
        xf = x.float()
        return (xf * torch.rsqrt(xf.pow(2).mean(-1, keepdim=True) + self.eps)).type_as(x) * self.weight


def rope_tables(seq, head_dim, base):
    inv = 1.0 / (base ** (torch.arange(0, head_dim, 2).float() / head_dim))
    freqs = torch.outer(torch.arange(seq).float(), inv)          # (seq, head_dim / 2)
    return freqs.cos(), freqs.sin()


def apply_rope(x, cos, sin):
    """Rotate pairs of features by an angle that grows with position. x: (B, H, T, head_dim)."""
    half = x.shape[-1] // 2
    x1, x2 = x[..., :half], x[..., half:]
    cos, sin = cos.to(x.dtype), sin.to(x.dtype)
    return torch.cat([x1 * cos - x2 * sin, x1 * sin + x2 * cos], dim=-1)


class Attention(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.n_head, self.head_dim = cfg.n_head, cfg.head_dim
        self.qkv = nn.Linear(cfg.d_model, 3 * cfg.d_model, bias=False)
        self.out = nn.Linear(cfg.d_model, cfg.d_model, bias=False)

    def forward(self, x, cos, sin, cache=None):
        B, T, C = x.shape
        q, k, v = self.qkv(x).split(C, dim=2)
        q = q.view(B, T, self.n_head, self.head_dim).transpose(1, 2)
        k = k.view(B, T, self.n_head, self.head_dim).transpose(1, 2)
        v = v.view(B, T, self.n_head, self.head_dim).transpose(1, 2)
        q, k = apply_rope(q, cos, sin), apply_rope(k, cos, sin)
        if cache is not None:
            if "k" in cache:
                assert T == 1, "after the prompt, feed one token at a time"
                k = torch.cat([cache["k"], k], dim=2)
                v = torch.cat([cache["v"], v], dim=2)
            cache["k"], cache["v"] = k, v
        y = F.scaled_dot_product_attention(q, k, v, is_causal=T > 1)
        return self.out(y.transpose(1, 2).contiguous().view(B, T, C))


class SwiGLU(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.hidden = cfg.ffn_hidden
        self.gate_up = nn.Linear(cfg.d_model, 2 * self.hidden, bias=False)
        self.down = nn.Linear(self.hidden, cfg.d_model, bias=False)

    def forward(self, x):
        gate, up = self.gate_up(x).split(self.hidden, dim=-1)
        return self.down(F.silu(gate) * up)


class Block(nn.Module):
    def __init__(self, cfg):
        super().__init__()
        self.norm1, self.attn = RMSNorm(cfg.d_model), Attention(cfg)
        self.norm2, self.mlp = RMSNorm(cfg.d_model), SwiGLU(cfg)

    def forward(self, x, cos, sin, cache=None):
        x = x + self.attn(self.norm1(x), cos, sin, cache)
        return x + self.mlp(self.norm2(x))


class GPT(nn.Module):
    def __init__(self, cfg: Config):
        super().__init__()
        self.cfg = cfg
        self.tok = nn.Embedding(cfg.vocab_size, cfg.d_model)
        self.blocks = nn.ModuleList(Block(cfg) for _ in range(cfg.n_layer))
        self.norm = RMSNorm(cfg.d_model)
        self.head = nn.Linear(cfg.d_model, cfg.vocab_size, bias=False)
        self.head.weight = self.tok.weight                       # tied embeddings
        cos, sin = rope_tables(cfg.max_seq, cfg.head_dim, cfg.rope_base)
        self.register_buffer("cos", cos, persistent=False)
        self.register_buffer("sin", sin, persistent=False)
        self.apply(self._init)
        for name, p in self.named_parameters():                  # smaller init for layers that add to the residual stream
            if name.endswith("attn.out.weight") or name.endswith("mlp.down.weight"):
                nn.init.normal_(p, std=0.02 / math.sqrt(2 * cfg.n_layer))

    @staticmethod
    def _init(m):
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, std=0.02)

    def num_params(self, embedding=True):
        n = sum(p.numel() for p in self.parameters())
        return n if embedding else n - self.tok.weight.numel()

    def forward(self, idx, targets=None, caches=None, pos=0):
        """Training: pass targets, get (logits, loss). Generation: pass caches (one dict per
        layer) and the position of idx's first token, get logits for the last position."""
        T = idx.shape[1]
        assert pos + T <= self.cfg.max_seq, f"sequence longer than {self.cfg.max_seq} tokens"
        x = self.tok(idx)
        cos, sin = self.cos[pos:pos + T], self.sin[pos:pos + T]
        for i, block in enumerate(self.blocks):
            x = block(x, cos, sin, None if caches is None else caches[i])
        x = self.norm(x)
        if targets is None:
            return self.head(x[:, -1:, :])
        logits = self.head(x)
        loss = F.cross_entropy(logits.float().view(-1, logits.size(-1)), targets.reshape(-1), ignore_index=-1)
        return logits, loss

    def config_dict(self):
        return asdict(self.cfg)
