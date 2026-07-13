/**
 * PaperPilot v3 — Demo Data Seed Script
 *
 * Generates realistic example data to replace the dev database for product
 * marketing/demo purposes. Creates 5 projects covering the full workflow:
 *   1. Accepted (success story)
 *   2. Rejected + resubmission branch (旁生分支)
 *   3. Pending revise (审稿返修)
 *   4. Experiment (active project)
 *   5. Ideation (early stage)
 *
 * Also creates on-disk LaTeX project files for projects past the writing phase.
 *
 * Usage:  node scripts/seed-demo-data.mjs
 */
import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DB_PATH = join(ROOT, '.data', 'electron', 'paperpilot_dev.db');
const LATEX_STORAGE = join(ROOT, '.data', 'electron', 'latex-projects');

// ============================================================================
//  PROJECTS
// ============================================================================

const projects = [
  {
    id: 'demo-accepted',
    title: 'Adaptive Sparse Attention for Efficient Long-Context Language Modeling',
    description:
      '提出自适应稀疏注意力机制（ASA），通过动态稀疏模式选择降低长上下文推理的计算开销。' +
      '核心思想是引入可学习的重要性评分网络，在推理时仅保留Top-k关键注意力连接，' +
      '从而将注意力复杂度从O(n²)降至O(n·k)。在LongBench和PG-19数据集上，' +
      'ASA在保持97%以上性能的同时，将推理延迟降低3.2倍，显存占用减少58%。',
    target_venue: 'NeurIPS 2025',
    tags: ['注意力机制', '长上下文', '效率优化'],
    phase: 'accepted',
    created_at: '2025-11-15 09:30:00',
    updated_at: '2026-06-20 14:00:00',
    status: 'active',
  },
  {
    id: 'demo-rejected',
    title: 'Diffusion-Guided Reinforcement Learning for Robotic Manipulation',
    description:
      '探索将扩散模型作为策略先验注入强化学习框架，以解决机器人操作任务中样本效率低的问题。' +
      '提出DiffRL算法，利用扩散模型在状态空间中生成高质量探索轨迹，' +
      '并通过Q值函数引导扩散过程向高回报区域偏移。' +
      '在MetaWorld和DMControl基准上，DiffRL相比SAC基线样本效率提升40%以上。',
    target_venue: 'CVPR 2025',
    tags: ['扩散模型', '强化学习', '机器人'],
    phase: 'rejected',
    created_at: '2026-01-10 10:00:00',
    updated_at: '2026-05-20 16:00:00',
    status: 'active',
  },
  {
    id: 'demo-revise',
    title:
      'Federated Learning with Heterogeneous Edge Devices: A Queueing Theory Approach',
    description:
      '从排队论视角分析异构边缘设备上的联邦学习系统性能瓶颈。' +
      '建立M/G/1排队模型刻画设备计算能力异构性对全局聚合延迟的影响，' +
      '并提出自适应设备调度策略AdaSync，根据队列状态动态调整参与训练的设备数量。' +
      '理论分析给出了收敛上界与排队延迟的显式关系，实验在CIFAR-10和FEMNIST上验证有效性。',
    target_venue: 'ICML 2026',
    tags: ['联邦学习', '边缘计算', '排队论'],
    phase: 'pending_revise',
    created_at: '2026-02-01 11:00:00',
    updated_at: '2026-07-01 15:00:00',
    status: 'active',
  },
  {
    id: 'demo-experiment',
    title:
      'Self-Supervised Graph Neural Networks for Molecular Property Prediction',
    description:
      '提出自监督图对比学习框架MolCL，通过分子子结构扰动和跨模态对齐学习分子表示。' +
      '核心创新是设计化学感知的图增强策略，保留分子的官能团语义同时随机扰动非关键边。' +
      '在MoleculeNet的12个基准任务上，MolCL在微调设置下平均AUC提升4.1%。',
    target_venue: 'ICLR 2026',
    tags: ['图神经网络', '分子预测', '自监督学习'],
    phase: 'experiment',
    created_at: '2026-05-01 09:00:00',
    updated_at: '2026-07-10 10:00:00',
    status: 'active',
  },
  {
    id: 'demo-ideation',
    title: 'Causal Discovery from Time Series with Large Language Models',
    description:
      '探索利用大语言模型的常识推理能力辅助时间序列因果发现。' +
      '初步构想是设计CauseLLM框架，将时间序列统计特征转化为自然语言描述，' +
      '通过提示工程引导LLM生成因果假设图，再用PC算法做统计检验 refinement。' +
      '目标是在小样本场景下优于纯统计方法。',
    target_venue: 'AAAI 2026',
    tags: ['因果发现', '时间序列', '大语言模型'],
    phase: 'ideation',
    created_at: '2026-07-08 14:00:00',
    updated_at: '2026-07-12 10:00:00',
    status: 'active',
  },
];

// ============================================================================
//  PROGRESS NODES — 主路径节点 (parent_branch_id = NULL)
// ============================================================================

function coreNodes(projectId, doneUpTo, inProgressPhase) {
  const phases = [
    ['ideation', '选题', 0],
    ['coding', '编码', 1],
    ['experiment', '实验', 2],
    ['writing', '撰写', 3],
    ['pending_submit', '待投稿', 4],
    ['submitted', '已投稿', 5],
  ];
  return phases.map(([phase, label, order]) => {
    let status = 'pending';
    if (order < doneUpTo) status = 'done';
    else if (order === doneUpTo && inProgressPhase) status = 'in_progress';
    else if (order <= doneUpTo) status = 'done';
    return {
      id: `node-${projectId}-${phase}`,
      project_id: projectId,
      phase,
      label,
      status,
      order_index: order,
      parent_branch_id: null,
    };
  });
}

// Project 1: accepted — 全部完成 + accepted 动态节点
const proj1Nodes = coreNodes('demo-accepted', 6, false).map((n) => ({
  ...n,
  status: 'done',
}));
proj1Nodes.push({
  id: 'node-demo-accepted-accepted',
  project_id: 'demo-accepted',
  phase: 'accepted',
  label: '已录用',
  status: 'done',
  order_index: 6,
  parent_branch_id: null,
});

// Project 2: rejected — 主路径到 rejected，分支到 coding
const proj2Nodes = coreNodes('demo-rejected', 6, false).map((n) => ({
  ...n,
  status: 'done',
}));
proj2Nodes.push({
  id: 'node-demo-rejected-rejected',
  project_id: 'demo-rejected',
  phase: 'rejected',
  label: '被拒稿',
  status: 'done',
  order_index: 6,
  parent_branch_id: null,
});
// 分支节点
proj2Nodes.push({
  id: 'node-demo-rejected-branch-ideation',
  project_id: 'demo-rejected',
  phase: 'ideation',
  label: '选题',
  status: 'done',
  order_index: 0,
  parent_branch_id: 'branch-demo-rejected',
});
proj2Nodes.push({
  id: 'node-demo-rejected-branch-coding',
  project_id: 'demo-rejected',
  phase: 'coding',
  label: '编码',
  status: 'in_progress',
  order_index: 1,
  parent_branch_id: 'branch-demo-rejected',
});

// Project 3: pending_revise
const proj3Nodes = coreNodes('demo-revise', 6, false).map((n) => ({
  ...n,
  status: 'done',
}));
proj3Nodes.push({
  id: 'node-demo-revise-pending_revise',
  project_id: 'demo-revise',
  phase: 'pending_revise',
  label: '待返修',
  status: 'in_progress',
  order_index: 6,
  parent_branch_id: null,
});

// Project 4: experiment — ideation done, coding done, experiment in_progress
const proj4Nodes = coreNodes('demo-experiment', 2, true);

// Project 5: ideation
const proj5Nodes = coreNodes('demo-ideation', 0, true);

const progressNodes = [
  ...proj1Nodes,
  ...proj2Nodes,
  ...proj3Nodes,
  ...proj4Nodes,
  ...proj5Nodes,
];

// ============================================================================
//  SUBMISSION BRANCHES (旁生分支)
// ============================================================================

const submissionBranches = [
  {
    id: 'branch-demo-rejected',
    project_id: 'demo-rejected',
    label: '转投 ICRA 2026',
    target_venue: 'ICRA 2026',
    status: 'active',
    created_at: '2026-05-20 16:00:00',
  },
];

// ============================================================================
//  CODE VERSIONS
// ============================================================================

const codeVersions = [
  // ---- Project 1 (accepted): 3 versions ----
  {
    id: 'cv-demo-accepted-1',
    project_id: 'demo-accepted',
    version_label: '初始实现',
    ai_summary: null,
    timestamp: '2025-12-20 15:30:00',
    git_commit_hash: null,
    diff_text: null,
    tags: ['baseline'],
    file_content: `import torch
import torch.nn as nn
import torch.nn.functional as F


class SparseAttention(nn.Module):
    """Naive sparse attention — selects top-k positions per query."""

    def __init__(self, dim, num_heads=8, top_k=64):
        super().__init__()
        self.num_heads = num_heads
        self.dim = dim
        self.head_dim = dim // num_heads
        self.top_k = top_k
        self.q_proj = nn.Linear(dim, dim)
        self.k_proj = nn.Linear(dim, dim)
        self.v_proj = nn.Linear(dim, dim)
        self.out_proj = nn.Linear(dim, dim)

    def forward(self, x, mask=None):
        B, N, C = x.shape
        q = self.q_proj(x).reshape(B, N, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).reshape(B, N, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).reshape(B, N, self.num_heads, self.head_dim).transpose(1, 2)

        scores = torch.matmul(q, k.transpose(-2, -1)) / (self.head_dim ** 0.5)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))

        # Naive top-k selection
        topk_vals, topk_idx = scores.topk(self.top_k, dim=-1)
        attn = F.softmax(topk_vals, dim=-1)
        ctx = torch.matmul(attn, v.gather(-2, topk_idx.unsqueeze(-1).expand(-1, -1, -1, self.head_dim)))
        ctx = ctx.transpose(1, 2).reshape(B, N, C)
        return self.out_proj(ctx)
`,
  },
  {
    id: 'cv-demo-accepted-2',
    project_id: 'demo-accepted',
    version_label: '引入重要性评分网络',
    ai_summary:
      '新增 ImportanceScorer 网络对注意力分数进行可学习的重新加权。相比v1的硬Top-k选择，' +
      '改为Gumbel-Softmax生成可微的稀疏掩码，支持端到端训练。在PG-19上验证损失降低12%。',
    timestamp: '2026-01-18 11:20:00',
    git_commit_hash: 'a3f2e1b',
    diff_text: `--- a/model.py
+++ b/model.py
@@ -12,6 +12,18 @@
 class SparseAttention(nn.Module):
+    def __init__(self, dim, num_heads=8, top_k=64, tau=1.0):
+        self.tau = tau
+        self.scorer = nn.Sequential(
+            nn.Linear(dim, dim // 4),
+            nn.GELU(),
+            nn.Linear(dim // 4, num_heads),
+        )
+
+    def forward(self, x):
+        importance = self.scorer(x)  # B, N, H
+        scores = scores * importance.unsqueeze(2)
+        mask = F.gumbel_softmax(scores, tau=self.tau, hard=True)`,
    tags: ['importance-scoring', 'gumbel-softmax'],
    file_content: `import torch
import torch.nn as nn
import torch.nn.functional as F


class ImportanceScorer(nn.Module):
    """Learnable importance scoring network for attention sparsification."""

    def __init__(self, dim, num_heads, hidden=None):
        super().__init__()
        hidden = hidden or dim // 4
        self.net = nn.Sequential(
            nn.Linear(dim, hidden),
            nn.GELU(),
            nn.Linear(hidden, num_heads),
        )

    def forward(self, x):
        return self.net(x)  # B, N, H


class AdaptiveSparseAttention(nn.Module):
    """ASA with differentiable top-k via Gumbel-Softmax."""

    def __init__(self, dim, num_heads=8, top_k=64, tau=1.0):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = dim // num_heads
        self.top_k = top_k
        self.tau = tau
        self.q_proj = nn.Linear(dim, dim)
        self.k_proj = nn.Linear(dim, dim)
        self.v_proj = nn.Linear(dim, dim)
        self.out_proj = nn.Linear(dim, dim)
        self.scorer = ImportanceScorer(dim, num_heads)

    def forward(self, x, mask=None):
        B, N, C = x.shape
        q = self.q_proj(x).reshape(B, N, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).reshape(B, N, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).reshape(B, N, self.num_heads, self.head_dim).transpose(1, 2)

        scores = torch.matmul(q, k.transpose(-2, -1)) / (self.head_dim ** 0.5)
        importance = self.scorer(x).transpose(1, 2).unsqueeze(-1)  # B, H, N, 1
        scores = scores * importance

        # Differentiable top-k via Gumbel-Softmax
        topk_vals, topk_idx = scores.topk(self.top_k, dim=-1)
        gumbel_mask = F.gumbel_softmax(topk_vals, tau=self.tau, hard=True)
        weighted = topk_vals * gumbel_mask
        attn = F.softmax(weighted, dim=-1)

        gathered_v = v.gather(-2, topk_idx.unsqueeze(-1).expand(-1, -1, -1, self.head_dim))
        ctx = torch.matmul(attn, gathered_v)
        ctx = ctx.transpose(1, 2).reshape(B, N, C)
        return self.out_proj(ctx)
`,
  },
  {
    id: 'cv-demo-accepted-3',
    project_id: 'demo-accepted',
    version_label: '优化推理路径 + CUDA kernel',
    ai_summary:
      '为推理模式实现自定义CUDA kernel替代Gumbel-Softmax，使用硬Top-k选择+稀疏矩阵乘法。' +
      '推理延迟从142ms降至44ms（序列长度8192）。训练时仍使用可微路径。',
    timestamp: '2026-02-10 09:45:00',
    git_commit_hash: 'c8d4a9f',
    diff_text: `--- a/model.py
+++ b/model.py
@@ -45,6 +45,22 @@
 class AdaptiveSparseAttention(nn.Module):
+    def forward(self, x, mode='train'):
+        if mode == 'infer':
+            return self._forward_infer(x)
+        return self._forward_train(x)
+
+    def _forward_infer(self, x):
+        # Hard top-k + sparse matmul (custom CUDA kernel)
+        scores = torch.matmul(q, k.transpose(-2, -1))
+        topk_vals, topk_idx = scores.topk(self.top_k, dim=-1)
+        attn = F.softmax(topk_vals, dim=-1)
+        # Use sparse representation for memory efficiency
+        ctx = sparse_attention(topk_idx, attn, v, self.top_k)
+        return ctx`,
    tags: ['cuda-kernel', 'inference-optimization'],
    file_content: `import torch
import torch.nn as nn
import torch.nn.functional as F

try:
    from ._kernels import sparse_attention_fwd
    HAS_CUDA_KERNEL = True
except ImportError:
    HAS_CUDA_KERNEL = False


class AdaptiveSparseAttention(nn.Module):
    """ASA with dual forward paths: differentiable train / fast inference."""

    def __init__(self, dim, num_heads=8, top_k=64, tau=1.0):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = dim // num_heads
        self.top_k = top_k
        self.tau = tau
        self.q_proj = nn.Linear(dim, dim)
        self.k_proj = nn.Linear(dim, dim)
        self.v_proj = nn.Linear(dim, dim)
        self.out_proj = nn.Linear(dim, dim)
        self.scorer = nn.Sequential(
            nn.Linear(dim, dim // 4),
            nn.GELU(),
            nn.Linear(dim // 4, num_heads),
        )

    def _forward_train(self, x):
        """Differentiable path with Gumbel-Softmax top-k."""
        B, N, C = x.shape
        q = self.q_proj(x).reshape(B, N, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).reshape(B, N, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).reshape(B, N, self.num_heads, self.head_dim).transpose(1, 2)
        scores = torch.matmul(q, k.transpose(-2, -1)) / (self.head_dim ** 0.5)
        importance = self.scorer(x).transpose(1, 2).unsqueeze(-1)
        scores = scores * importance
        topk_vals, topk_idx = scores.topk(self.top_k, dim=-1)
        gumbel_mask = F.gumbel_softmax(topk_vals, tau=self.tau, hard=True)
        attn = F.softmax(topk_vals * gumbel_mask, dim=-1)
        gathered_v = v.gather(-2, topk_idx.unsqueeze(-1).expand(-1, -1, -1, self.head_dim))
        ctx = torch.matmul(attn, gathered_v)
        ctx = ctx.transpose(1, 2).reshape(B, N, C)
        return self.out_proj(ctx)

    def _forward_infer(self, x):
        """Fast inference path with custom CUDA kernel."""
        B, N, C = x.shape
        q = self.q_proj(x).reshape(B, N, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).reshape(B, N, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).reshape(B, N, self.num_heads, self.head_dim).transpose(1, 2)
        scores = torch.matmul(q, k.transpose(-2, -1)) / (self.head_dim ** 0.5)
        if HAS_CUDA_KERNEL and x.is_cuda:
            ctx = sparse_attention_fwd(scores, v, self.top_k)
        else:
            topk_vals, topk_idx = scores.topk(self.top_k, dim=-1)
            attn = F.softmax(topk_vals, dim=-1)
            gathered_v = v.gather(-2, topk_idx.unsqueeze(-1).expand(-1, -1, -1, self.head_dim))
            ctx = torch.matmul(attn, gathered_v)
        ctx = ctx.transpose(1, 2).reshape(B, N, C)
        return self.out_proj(ctx)

    def forward(self, x):
        return self._forward_train(x) if self.training else self._forward_infer(x)
`,
  },

  // ---- Project 2 (rejected): 2 versions ----
  {
    id: 'cv-demo-rejected-1',
    project_id: 'demo-rejected',
    version_label: 'DiffRL baseline',
    ai_summary: null,
    timestamp: '2026-02-15 14:00:00',
    git_commit_hash: null,
    diff_text: null,
    tags: ['baseline'],
    file_content: `import torch
import torch.nn as nn
from diffusers import DDPMScheduler, UNet1DModel


class DiffPolicy(nn.Module):
    """Diffusion-based policy for RL exploration."""

    def __init__(self, state_dim, action_dim, hidden=256, num_steps=100):
        super().__init__()
        self.state_dim = state_dim
        self.action_dim = action_dim
        self.num_steps = num_steps
        self.net = UNet1DModel(
            sample_size=action_dim,
            in_channels=state_dim + action_dim,
            out_channels=action_dim,
            block_out_channels=(hidden, hidden, hidden),
        )
        self.scheduler = DDPMScheduler(num_train_timesteps=num_steps)

    def generate(self, state, num_samples=1):
        """Generate candidate actions from diffusion."""
        B = state.shape[0]
        x = torch.randn(B, self.action_dim, num_samples, device=state.device)
        state_cond = state.unsqueeze(-1).expand(-1, -1, num_samples)
        for t in self.scheduler.timesteps:
            timesteps = torch.full((B,), t, device=state.device)
            model_input = torch.cat([x, state_cond], dim=1)
            noise_pred = self.net(model_input, timesteps).sample
            x = self.scheduler.step(noise_pred, t, x).prev_sample
        return x
`,
  },
  {
    id: 'cv-demo-rejected-2',
    project_id: 'demo-rejected',
    version_label: 'Q-value guided diffusion',
    ai_summary:
      '在DiffPolicy基础上引入Q值引导，通过classifier-free guidance将扩散采样向高Q值区域偏移。' +
      '新增guidance_scale参数控制引导强度。在MetaWorld reach任务上成功率从67%提升至84%。',
    timestamp: '2026-03-22 10:30:00',
    git_commit_hash: 'f5b2c8e',
    diff_text: `--- a/diff_rl.py
+++ b/diff_rl.py
@@ -28,6 +28,16 @@
 class DiffPolicy(nn.Module):
+    def generate(self, state, q_fn=None, guidance_scale=3.0):
+        for t in self.scheduler.timesteps:
+            noise_pred = self.net(model_input, timesteps).sample
+            if q_fn is not None:
+                # Classifier-free guidance toward high-Q actions
+                with torch.enable_grad():
+                    x_grad = x.detach().requires_grad_(True)
+                    q_val = q_fn(state, x_grad)
+                    grad = torch.autograd.grad(q_val.sum(), x_grad)[0]
+                    noise_pred = noise_pred - guidance_scale * grad
+            x = self.scheduler.step(noise_pred, t, x).prev_sample`,
    tags: ['q-guidance', 'classifier-free'],
    file_content: `import torch
import torch.nn as nn
from diffusers import DDPMScheduler, UNet1DModel


class QNetwork(nn.Module):
    def __init__(self, state_dim, action_dim, hidden=256):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(state_dim + action_dim, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Linear(hidden, 1),
        )

    def forward(self, state, action):
        return self.net(torch.cat([state, action], dim=-1))


class GuidedDiffPolicy(nn.Module):
    """Q-value guided diffusion policy for RL."""

    def __init__(self, state_dim, action_dim, hidden=256, num_steps=100):
        super().__init__()
        self.action_dim = action_dim
        self.num_steps = num_steps
        self.net = UNet1DModel(
            sample_size=action_dim,
            in_channels=state_dim + action_dim,
            out_channels=action_dim,
            block_out_channels=(hidden, hidden, hidden),
        )
        self.scheduler = DDPMScheduler(num_train_timesteps=num_steps)
        self.q_net = QNetwork(state_dim, action_dim, hidden)

    def generate(self, state, num_samples=1, guidance_scale=3.0):
        """Generate actions guided by Q-value gradient."""
        B = state.shape[0]
        x = torch.randn(B, self.action_dim, num_samples, device=state.device)
        state_cond = state.unsqueeze(-1).expand(-1, -1, num_samples)
        for t in self.scheduler.timesteps:
            timesteps = torch.full((B,), t, device=state.device)
            model_input = torch.cat([x, state_cond], dim=1)
            noise_pred = self.net(model_input, timesteps).sample
            if guidance_scale > 0 and self.training:
                with torch.enable_grad():
                    x_grad = x.detach().requires_grad_(True)
                    q_val = self.q_net(
                        state.unsqueeze(-1).expand(-1, -1, num_samples).reshape(-1, self.state_dim),
                        x_grad.reshape(-1, self.action_dim),
                    )
                    grad = torch.autograd.grad(q_val.sum(), x_grad)[0]
                    noise_pred = noise_pred - guidance_scale * grad
            x = self.scheduler.step(noise_pred, t, x).prev_sample
        return x
`,
  },

  // ---- Project 3 (pending_revise): 2 versions ----
  {
    id: 'cv-demo-revise-1',
    project_id: 'demo-revise',
    version_label: 'AdaSync初版',
    ai_summary: null,
    timestamp: '2026-03-10 16:00:00',
    git_commit_hash: null,
    diff_text: null,
    tags: ['baseline'],
    file_content: `import numpy as np
from collections import deque


class DeviceQueue:
    """M/G/1 queue model for heterogeneous edge devices."""

    def __init__(self, num_devices, arrival_rate, service_dist):
        self.num_devices = num_devices
        self.arrival_rate = arrival_rate  # lambda
        self.service_dist = service_dist  # arbitrary distribution
        self.queues = [deque() for _ in range(num_devices)]
        self.service_times = np.zeros(num_devices)

    def expected_delay(self, device_idx):
        """E[W] = rho / (mu * (1 - rho)) for M/G/1 with Kingman's formula."""
        mu = 1.0 / np.mean(self.service_dist[device_idx])
        sigma2 = np.var(self.service_dist[device_idx])
        rho = self.arrival_rate / (mu * self.num_devices)
        if rho >= 1:
            return float('inf')
        # Kingman's approximation: E[W] = (rho/(1-rho)) * (1 + CV^2) / (2*mu)
        cv2 = sigma2 * mu * mu
        return (rho / (1 - rho)) * (1 + cv2) / (2 * mu)


class AdaSync:
    """Adaptive device scheduling based on queue state."""

    def __init__(self, num_devices, max_participants=None):
        self.num_devices = num_devices
        self.max_participants = max_participants or num_devices
        self.queue = DeviceQueue(num_devices, arrival_rate=1.0, service_dist=np.ones(num_devices))

    def select_devices(self, round_idx):
        """Select devices for current aggregation round."""
        delays = [self.queue.expected_delay(i) for i in range(self.num_devices)]
        sorted_idx = np.argsort(delays)
        k = min(self.max_participants, self.num_devices)
        return sorted_idx[:k].tolist()
`,
  },
  {
    id: 'cv-demo-revise-2',
    project_id: 'demo-revise',
    version_label: '收敛上界推导 + 动态调整',
    ai_summary:
      '完成AdaSync收敛性理论分析，给出L-smooth假设下与非均匀设备参与率的显式收敛上界。' +
      '新增动态k调整策略：根据当前队列积压量自适应调整参与设备数。CIFAR-10非IID实验收敛加速1.8x。',
    timestamp: '2026-04-05 13:15:00',
    git_commit_hash: 'd7e3b1a',
    diff_text: `--- a/adasync.py
+++ b/adasync.py
@@ -35,6 +35,25 @@
 class AdaSync:
+    def __init__(self, num_devices, max_participants=None, eta=0.01, L=1.0):
+        self.eta = eta  # learning rate
+        self.L = L      # smoothness constant
+        self.convergence_bound = None
+
+    def theoretical_bound(self, T, sigma2, Delta0):
+        """Convergence bound: (1 - eta*L*k/n)^T * Delta0 + sigma2/(k*mu)"""
+        k = self.max_participants
+        n = self.num_devices
+        contraction = (1 - self.eta * self.L * k / n) ** T
+        noise = sigma2 / (k * self.arrival_rate)
+        self.convergence_bound = contraction * Delta0 + noise
+        return self.convergence_bound
+
+    def select_devices(self, round_idx):
+        # Dynamic k: increase if queue backlog is low, decrease if high
+        backlog = sum(len(q) for q in self.queue.queues)
+        k = max(1, min(self.max_participants, n - backlog))
+        return sorted_idx[:k].tolist()`,
    tags: ['convergence-bound', 'dynamic-k'],
    file_content: `import numpy as np
from collections import deque


class DeviceQueue:
    """M/G/1 queue model for heterogeneous edge devices."""

    def __init__(self, num_devices, arrival_rate, service_dist):
        self.num_devices = num_devices
        self.arrival_rate = arrival_rate
        self.service_dist = service_dist
        self.queues = [deque() for _ in range(num_devices)]
        self.service_times = np.zeros(num_devices)

    def expected_delay(self, device_idx):
        mu = 1.0 / np.mean(self.service_dist[device_idx])
        sigma2 = np.var(self.service_dist[device_idx])
        rho = self.arrival_rate / (mu * self.num_devices)
        if rho >= 1:
            return float('inf')
        cv2 = sigma2 * mu * mu
        return (rho / (1 - rho)) * (1 + cv2) / (2 * mu)

    def backlog(self):
        return sum(len(q) for q in self.queues)


class AdaSync:
    """Adaptive device scheduling with convergence guarantees."""

    def __init__(self, num_devices, max_participants=None, eta=0.01, L=1.0):
        self.num_devices = num_devices
        self.max_participants = max_participants or num_devices
        self.eta = eta
        self.L = L
        self.queue = DeviceQueue(num_devices, arrival_rate=1.0, service_dist=np.ones(num_devices))
        self.convergence_bound = None

    def theoretical_bound(self, T, sigma2, Delta0):
        """E[F(w_T) - F*] <= (1 - eta*L*k/n)^T * Delta0 + sigma2*eta/(2*k)"""
        k = self.max_participants
        n = self.num_devices
        contraction = (1 - self.eta * self.L * k / n) ** T
        noise = sigma2 * self.eta / (2 * k)
        self.convergence_bound = contraction * Delta0 + noise
        return self.convergence_bound

    def select_devices(self, round_idx):
        """Dynamic k: adjust based on queue backlog."""
        delays = [self.queue.expected_delay(i) for i in range(self.num_devices)]
        sorted_idx = np.argsort(delays)
        backlog = self.queue.backlog()
        # Reduce participants when backlog is high to prevent straggler effect
        k = max(1, min(self.max_participants, self.num_devices - backlog))
        return sorted_idx[:k].tolist()
`,
  },

  // ---- Project 4 (experiment): 2 versions ----
  {
    id: 'cv-demo-experiment-1',
    project_id: 'demo-experiment',
    version_label: 'MolCL框架搭建',
    ai_summary: null,
    timestamp: '2026-05-25 11:00:00',
    git_commit_hash: null,
    diff_text: null,
    tags: ['scaffold'],
    file_content: `import torch
import torch.nn as nn
from torch_geometric.nn import GINConv, global_mean_pool


class MolecularEncoder(nn.Module):
    """GIN-based molecular graph encoder."""

    def __init__(self, num_atom_features, hidden=300, num_layers=5):
        super().__init__()
        self.layers = nn.ModuleList()
        for i in range(num_layers):
            mlp = nn.Sequential(
                nn.Linear(hidden, hidden),
                nn.ReLU(),
                nn.Linear(hidden, hidden),
            )
            self.layers.append(GINConv(mlp))
        self.proj = nn.Linear(num_atom_features, hidden)

    def forward(self, x, edge_index, batch):
        h = self.proj(x)
        for layer in self.layers:
            h = layer(h, edge_index)
        return global_mean_pool(h, batch)


class MolCL(nn.Module):
    """Molecular contrastive learning framework."""

    def __init__(self, num_atom_features, hidden=300, tau=0.1):
        super().__init__()
        self.encoder = MolecularEncoder(num_atom_features, hidden)
        self.projector = nn.Sequential(
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Linear(hidden, 128),
        )
        self.tau = tau

    def forward(self, graph1, graph2):
        h1 = self.projector(self.encoder(*graph1))
        h2 = self.projector(self.encoder(*graph2))
        h1 = torch.nn.functional.normalize(h1, dim=-1)
        h2 = torch.nn.functional.normalize(h2, dim=-1)
        logits = torch.matmul(h1, h2.T) / self.tau
        labels = torch.arange(h1.size(0), device=h1.device)
        loss = torch.nn.functional.cross_entropy(logits, labels)
        return loss, h1
`,
  },
  {
    id: 'cv-demo-experiment-2',
    project_id: 'demo-experiment',
    version_label: '化学感知图增强',
    ai_summary:
      '实现ChemAug图增强策略：基于官能团检测保留关键子结构，仅扰动非关键边和节点。' +
      '新增RDKit集成的官能团识别模块，避免破坏分子的化学语义。对比学习准确率提升6.3%。',
    timestamp: '2026-06-18 15:45:00',
    git_commit_hash: 'b9f4d2c',
    diff_text: `--- a/molcl.py
+++ b/molcl.py
@@ -30,6 +30,32 @@
 class MolCL(nn.Module):
+    from rdkit import Chem
+
+    def chem_aug(self, data, p_edge=0.2, p_node=0.1):
+        """Chemistry-aware augmentation: preserve functional groups."""
+        mol = Chem.RWMol(data.mol)
+        # Identify functional groups (SMARTS patterns)
+        fg_patterns = ['[CX3](=O)[OX2H1]', '[NX3][CX3](=[OX1])', ...]
+        protected = set()
+        for smarts in fg_patterns:
+            for match in mol.GetSubstructMatches(Chem.MolFromSmarts(smarts)):
+                protected.update(match)
+        # Only perturb non-protected atoms/bonds
+        mask = torch.rand(data.edge_index.size(1)) < p_edge
+        protected_edges = self._edges_with_protected(data.edge_index, protected)
+        mask = mask & ~protected_edges
+        return self._apply_edge_drop(data, mask)`,
    tags: ['chem-aug', 'rdkit'],
    file_content: `import torch
import torch.nn as nn
from torch_geometric.nn import GINConv, global_mean_pool
try:
    from rdkit import Chem
    from rdkit.Chem import FunctionalGroups
    HAS_RDKIT = True
except ImportError:
    HAS_RDKIT = False


class MolecularEncoder(nn.Module):
    def __init__(self, num_atom_features, hidden=300, num_layers=5):
        super().__init__()
        self.layers = nn.ModuleList()
        for i in range(num_layers):
            mlp = nn.Sequential(
                nn.Linear(hidden, hidden), nn.ReLU(), nn.Linear(hidden, hidden),
            )
            self.layers.append(GINConv(mlp))
        self.proj = nn.Linear(num_atom_features, hidden)

    def forward(self, x, edge_index, batch):
        h = self.proj(x)
        for layer in self.layers:
            h = layer(h, edge_index)
        return global_mean_pool(h, batch)


# Functional group SMARTS patterns to preserve during augmentation
FG_PATTERNS = [
    '[CX3](=O)[OX2H1]',   # carboxylic acid
    '[NX3][CX3](=[OX1])', # amide
    '[OX2H1]',            # hydroxyl
    '[SX2H1]',            # thiol
    '[nX3]',              # aromatic N
]


class ChemAug:
    """Chemistry-aware graph augmentation preserving functional groups."""

    def __init__(self, p_edge=0.2, p_node=0.1):
        self.p_edge = p_edge
        self.p_node = p_node

    def get_protected_atoms(self, mol):
        if not HAS_RDKIT or mol is None:
            return set()
        protected = set()
        for smarts in FG_PATTERNS:
            pattern = Chem.MolFromSmarts(smarts)
            if pattern:
                for match in mol.GetSubstructMatches(pattern):
                    protected.update(match)
        return protected

    def __call__(self, data):
        protected = self.get_protected_atoms(data.mol if hasattr(data, 'mol') else None)
        edge_mask = torch.rand(data.edge_index.size(1)) < self.p_edge
        if protected:
            src, dst = data.edge_index
            is_protected = torch.zeros(data.edge_index.size(1), dtype=torch.bool)
            for idx in range(src.size(0)):
                if int(src[idx]) in protected or int(dst[idx]) in protected:
                    is_protected[idx] = True
            edge_mask = edge_mask & ~is_protected
        data.edge_index = data.edge_index[:, ~edge_mask]
        return data


class MolCL(nn.Module):
    def __init__(self, num_atom_features, hidden=300, tau=0.1):
        super().__init__()
        self.encoder = MolecularEncoder(num_atom_features, hidden)
        self.projector = nn.Sequential(
            nn.Linear(hidden, hidden), nn.ReLU(), nn.Linear(hidden, 128),
        )
        self.tau = tau
        self.augment = ChemAug()

    def forward(self, graph1, graph2):
        aug1 = self.augment(graph1)
        aug2 = self.augment(graph2)
        h1 = torch.nn.functional.normalize(self.projector(self.encoder(*aug1)), dim=-1)
        h2 = torch.nn.functional.normalize(self.projector(self.encoder(*aug2)), dim=-1)
        logits = torch.matmul(h1, h2.T) / self.tau
        labels = torch.arange(h1.size(0), device=h1.device)
        return torch.nn.functional.cross_entropy(logits, labels), h1
`,
  },
];

// ============================================================================
//  EXPERIMENTS
// ============================================================================

const experiments = [
  // ---- Project 1 (accepted): 4 experiments ----
  {
    id: 'exp-demo-accepted-1',
    project_id: 'demo-accepted',
    name: '主实验：LongBench多任务对比',
    experiment_type: 'comparison',
    dataset: 'LongBench (14 tasks)',
    model: 'ASA-Base / ASA-Large',
    hyperparameters: {
      num_heads: 8,
      hidden_dim: 1024,
      top_k: 64,
      tau: 1.0,
      batch_size: 32,
      learning_rate: 0.0003,
      warmup_steps: 1000,
      weight_decay: 0.01,
    },
    metrics: {
      avg_score: '62.3 (Base) / 65.8 (Large)',
      vs_full_attention: '-1.8 / -0.3',
      inference_latency_ms: '44.2 / 52.1',
      memory_gb: '8.4 / 12.7',
    },
    notes:
      'ASA-Base在14个任务上平均仅落后全注意力1.8分，但推理速度快3.2倍。' +
      'ASA-Large在多数任务上与全注意力持平甚至超越。',
    status: 'done',
    created_at: '2026-02-05 10:00:00',
  },
  {
    id: 'exp-demo-accepted-2',
    project_id: 'demo-accepted',
    name: '消融实验：重要性评分网络',
    experiment_type: 'ablation',
    dataset: 'PG-19',
    model: 'ASA w/o scorer / w/ scorer',
    hyperparameters: { top_k: 64, layers: 12, seq_len: 8192 },
    metrics: {
      perplexity: '11.42 (w/o) / 10.87 (w/)',
      throughput: '2150 / 2080 tokens/s',
    },
    notes: '移除重要性评分后PPL上升0.55，验证可学习稀疏模式选择的有效性。',
    status: 'done',
    created_at: '2026-02-08 14:00:00',
  },
  {
    id: 'exp-demo-accepted-3',
    project_id: 'demo-accepted',
    name: '消融实验：Gumbel-Softmax vs 硬Top-k',
    experiment_type: 'ablation',
    dataset: 'PG-19',
    model: 'ASA-Hard / ASA-Gumbel',
    hyperparameters: { tau: [0.5, 1.0, 2.0], top_k: 64 },
    metrics: {
      perplexity: '11.15 (Hard) / 10.87 (Gumbel)',
      training_stability: 'Hard: 收敛慢 | Gumbel: 稳定',
    },
    notes: 'Gumbel-Softmax在训练阶段提供更好的梯度流，tau=1.0时效果最优。',
    status: 'done',
    created_at: '2026-02-09 16:00:00',
  },
  {
    id: 'exp-demo-accepted-4',
    project_id: 'demo-accepted',
    name: '序列长度敏感性分析',
    experiment_type: 'sensitivity',
    dataset: 'PG-19',
    model: 'ASA-Large',
    hyperparameters: { seq_len: [4096, 8192, 16384, 32768], top_k: [32, 64, 128, 256] },
    metrics: {
      latency_4k: '12.3ms (k=32) / 14.1ms (k=64)',
      latency_32k: '52.1ms (k=64) / 98.7ms (k=256)',
      memory_32k: '6.2GB (k=64) / 14.8GB (k=256)',
    },
    notes: 'k=64在32k序列长度下达到延迟与质量的最佳平衡点。',
    status: 'done',
    created_at: '2026-02-12 09:30:00',
  },

  // ---- Project 2 (rejected): 3 experiments ----
  {
    id: 'exp-demo-rejected-1',
    project_id: 'demo-rejected',
    name: 'MetaWorld基准测试',
    experiment_type: 'comparison',
    dataset: 'MetaWorld (50 tasks)',
    model: 'SAC / DiffRL / DiffRL+Guidance',
    hyperparameters: {
      num_diffusion_steps: 100,
      guidance_scale: 3.0,
      batch_size: 256,
      replay_buffer: 1000000,
    },
    metrics: {
      success_rate: 'SAC: 71% | DiffRL: 78% | DiffRL+G: 84%',
      sample_efficiency: '达到80%成功率所需episodes: SAC 320k | DiffRL 180k',
    },
    notes: 'Q值引导显著提升样本效率，但guidance_scale过大时出现训练不稳定。',
    status: 'done',
    created_at: '2026-03-15 11:00:00',
  },
  {
    id: 'exp-demo-rejected-2',
    project_id: 'demo-rejected',
    name: 'DMControl视觉输入实验',
    experiment_type: 'comparison',
    dataset: 'DMControl (6 tasks)',
    model: 'DreamerV3 / DiffRL',
    hyperparameters: { image_size: 84, frame_stack: 3, num_steps: 100 },
    metrics: {
      episode_return: 'DreamerV3: 812 | DiffRL: 673',
      note: 'DiffRL在视觉输入任务上表现不及DreamerV3',
    },
    notes: '在像素级观测任务上，扩散策略的表达能力不如世界模型方法。',
    status: 'done',
    created_at: '2026-03-20 14:00:00',
  },
  {
    id: 'exp-demo-rejected-3',
    project_id: 'demo-rejected',
    name: 'guidance_scale敏感性',
    experiment_type: 'sensitivity',
    dataset: 'MetaWorld reach / push / pick',
    model: 'DiffRL+Guidance',
    hyperparameters: { guidance_scale: [0, 1, 3, 5, 10, 20] },
    metrics: {
      best_scale: '3.0 (reach) / 5.0 (push) / 1.0 (pick)',
      failure_at_20: '训练发散，成功率降至12%',
    },
    notes: '最优guidance_scale因任务复杂度而异，高复杂度任务需要更弱的引导。',
    status: 'done',
    created_at: '2026-03-25 10:00:00',
  },

  // ---- Project 3 (pending_revise): 3 experiments ----
  {
    id: 'exp-demo-revise-1',
    project_id: 'demo-revise',
    name: 'CIFAR-10非IID联邦学习',
    experiment_type: 'comparison',
    dataset: 'CIFAR-10 (Dirichlet alpha=0.1)',
    model: 'FedAvg / FedProx / AdaSync',
    hyperparameters: {
      num_devices: 100,
      max_participants: 10,
      rounds: 200,
      local_epochs: 5,
      learning_rate: 0.01,
    },
    metrics: {
      test_accuracy: 'FedAvg: 68.2% | FedProx: 70.1% | AdaSync: 73.8%',
      convergence_round: 'FedAvg: 180 | AdaSync: 98',
    },
    notes: 'AdaSync在极端非IID场景下收敛速度提升1.8倍，最终准确率高出5.6%。',
    status: 'done',
    created_at: '2026-04-10 11:00:00',
  },
  {
    id: 'exp-demo-revise-2',
    project_id: 'demo-revise',
    name: '设备异构性模拟',
    experiment_type: 'comparison',
    dataset: 'FEMNIST',
    model: 'FedAvg / AdaSync',
    hyperparameters: {
      num_devices: 50,
      compute_variance: 'lognormal(sigma=1.0)',
      max_participants: 10,
    },
    metrics: {
      avg_round_delay: 'FedAvg: 47.2s | AdaSync: 23.1s',
      straggler_ratio: 'FedAvg: 34% | AdaSync: 8%',
    },
    notes: '动态k调整有效缓解straggler效应，平均轮次延迟降低51%。',
    status: 'done',
    created_at: '2026-04-15 14:00:00',
  },
  {
    id: 'exp-demo-revise-3',
    project_id: 'demo-revise',
    name: '收敛上界验证',
    experiment_type: 'other',
    dataset: 'MNIST (synthetic)',
    model: 'AdaSync (理论vs实验)',
    hyperparameters: { eta: 0.01, L: 1.0, T: 500 },
    metrics: {
      theoretical_bound: '0.0234',
      empirical_loss: '0.0198',
      bound_tightness: '实验值在理论上界内，间隙15%',
    },
    notes: '理论上界在T≥200后与实验值吻合良好，验证了收敛性分析的正确性。',
    status: 'done',
    created_at: '2026-04-20 10:00:00',
  },

  // ---- Project 4 (experiment): 2 experiments ----
  {
    id: 'exp-demo-experiment-1',
    project_id: 'demo-experiment',
    name: 'MoleculeNet基准（微调）',
    experiment_type: 'comparison',
    dataset: 'MoleculeNet (12 tasks)',
    model: 'GCN / GIN / MolCL',
    hyperparameters: {
      hidden: 300,
      layers: 5,
      pretrain_epochs: 100,
      finetune_epochs: 50,
      batch_size: 256,
      tau: 0.1,
    },
    metrics: {
      avg_auc: 'GCN: 72.1 | GIN: 75.4 | MolCL: 79.5',
      improvement: '+4.1% over GIN',
    },
    notes: '在BBBP、Tox21、ClinTox等任务上提升显著，但在物理化学性质预测任务上提升有限。',
    status: 'done',
    created_at: '2026-06-20 15:00:00',
  },
  {
    id: 'exp-demo-experiment-2',
    project_id: 'demo-experiment',
    name: '图增强策略消融',
    experiment_type: 'ablation',
    dataset: 'MoleculeNet (BBBP + BACE)',
    model: 'MolCL w/ random aug / w/ ChemAug',
    hyperparameters: {
      p_edge: [0.1, 0.2, 0.3, 0.4],
      p_node: [0.05, 0.1, 0.15],
      preserve_fg: [false, true],
    },
    metrics: {
      bbbp_auc: 'Random: 68.7 | ChemAug: 71.2',
      bace_auc: 'Random: 79.1 | ChemAug: 82.4',
    },
    notes: '正在补充官能团保留比例对性能影响的详细分析。当前结果显示ChemAug在所有扰动强度下均优于随机增强。',
    status: 'running',
    created_at: '2026-07-05 10:00:00',
  },
];

// ============================================================================
//  LATEX VERSIONS
// ============================================================================

const latexVersions = [
  {
    id: 'lv-demo-accepted-1',
    project_id: 'demo-accepted',
    version_label: '投稿版本',
    ai_summary:
      '投稿版包含完整的ASA方法描述、理论分析（复杂度证明）、LongBench和PG-19实验。' +
      '共8页正文 + 2页附录（CUDA kernel实现细节）。',
    timestamp: '2026-03-14 22:30:00',
    git_commit_hash: 'e2a9b4f',
  },
  {
    id: 'lv-demo-accepted-2',
    project_id: 'demo-accepted',
    version_label: 'Camera Ready',
    ai_summary:
      '根据审稿意见补充了与FlashAttention的对比实验，新增Figure 3展示不同top_k值的Pareto前沿。' +
      '修改了Related Work部分，增加对Linear Attention的讨论。',
    timestamp: '2026-06-18 18:00:00',
    git_commit_hash: 'b7c3e8d',
  },
  {
    id: 'lv-demo-rejected-1',
    project_id: 'demo-rejected',
    version_label: 'CVPR投稿版',
    ai_summary:
      '8页正文，包含DiffRL方法、MetaWorld和DMControl实验。Reviewer主要质疑视觉任务表现和与DreamerV3的对比公平性。',
    timestamp: '2026-03-19 20:00:00',
    git_commit_hash: 'f5b2c8e',
  },
  {
    id: 'lv-demo-revise-1',
    project_id: 'demo-revise',
    version_label: '投稿版本',
    ai_summary:
      '9页正文，包含M/G/1排队模型推导、AdaSync算法、CIFAR-10和FEMNIST实验。理论部分占比40%。',
    timestamp: '2026-05-09 23:00:00',
    git_commit_hash: 'd7e3b1a',
  },
  {
    id: 'lv-demo-revise-2',
    project_id: 'demo-revise',
    version_label: '返修草稿',
    ai_summary:
      '根据Reviewer意见补充了与FedNova的对比实验，扩展了理论分析（新增非凸情况下的收敛上界）。修改了Figure 2。',
    timestamp: '2026-07-05 16:00:00',
    git_commit_hash: 'a1b2c3d',
  },
];

// ============================================================================
//  EMAILS
// ============================================================================

const emails = [
  // ---- Project 1 (accepted): 5 emails ----
  {
    id: 'email-demo-accepted-1',
    project_id: 'demo-accepted',
    subject: 'NeurIPS 2025 Submission Confirmation — Paper #3847',
    sender: 'noreply@neurips.cc',
    received_at: '2026-03-15 03:22:00',
    email_type: 'other',
    ai_summary: 'NeurIPS 2025投稿确认邮件，分配论文编号#3847，截止日期前完成提交。',
    is_read: 1,
    is_important: 0,
    raw_content: `Dear Author,

Thank you for submitting your paper to NeurIPS 2025. Your submission has been received successfully.

Paper ID: 3847
Title: Adaptive Sparse Attention for Efficient Long-Context Language Modeling
Track: Main Conference
Subject Areas: Optimization, Attention Mechanisms, Efficient Methods

You will be notified of the review outcome by May 1, 2026. Please do not reply to this automated email.

NeurIPS 2025 Program Committee`,
    message_id: '<conf-3847@neurips.cc>',
  },
  {
    id: 'email-demo-accepted-2',
    project_id: 'demo-accepted',
    subject: 'NeurIPS 2025 Review — Paper #3847 (Reviewer qvKp)',
    sender: 'reviews@neurips.cc',
    received_at: '2026-05-01 08:15:00',
    email_type: 'review',
    ai_summary:
      '审稿人1评分6/8/6。肯定了ASA的创新性和实验充分性，建议增加与FlashAttention-2的对比，并讨论k的自适应选择策略。',
    is_read: 1,
    is_important: 1,
    raw_content: `Paper #3847 Review

Rating: 6 (Marginally above acceptance threshold)
Confidence: 4 (Confident)

Summary:
The paper proposes Adaptive Sparse Attention (ASA), which uses a learnable importance scoring network combined with Gumbel-Softmax to achieve differentiable top-k attention selection. The idea is interesting and the experiments on LongBench are comprehensive.

Strengths:
1. The importance scoring network is a novel addition to sparse attention methods
2. Comprehensive experiments on LongBench (14 tasks) and PG-19
3. The dual forward path (train/infer) design is practical

Weaknesses:
1. Missing comparison with FlashAttention-2, which is the current SOTA efficient attention
2. The top_k is fixed — would adaptive k selection per layer/head improve results?
3. The Gumbel-Softmax temperature tau is not well analyzed

Questions:
1. How does ASA compare to FlashAttention-2 on the same hardware?
2. Have you tried learnable per-head k values?
3. What is the sensitivity to tau during training?`,
    message_id: '<review-3847-qvKp@neurips.cc>',
  },
  {
    id: 'email-demo-accepted-3',
    project_id: 'demo-accepted',
    subject: 'NeurIPS 2025 Review — Paper #3847 (Reviewer mZ3L)',
    sender: 'reviews@neurips.cc',
    received_at: '2026-05-01 08:15:00',
    email_type: 'review',
    ai_summary:
      '审稿人2评分8/8/5。高度评价ASA的工程价值和理论分析，认为排队论分析是亮点。建议补充显存占用与序列长度的理论关系。',
    is_read: 1,
    is_important: 1,
    raw_content: `Paper #3847 Review

Rating: 8 (Top 50% of accepted papers)
Confidence: 5 (Absolutely certain)

Summary:
This is a well-executed paper on sparse attention. The ASA method combines a learnable scorer with Gumbel-Softmax for differentiable top-k selection, and the custom CUDA kernel for inference is impressive engineering. The complexity analysis is thorough.

Strengths:
1. Excellent engineering — the CUDA kernel implementation shows practical maturity
2. The complexity analysis (Theorem 1) correctly captures the trade-off
3. Strong experimental results — 3.2x speedup with minimal quality loss
4. The dual-path design (differentiable train, fast inference) is elegant

Weaknesses:
1. The relationship between memory usage and sequence length could be made more explicit in the theory section
2. Some experiments lack error bars

Recommendation: Accept after minor revision.`,
    message_id: '<review-3847-mZ3L@neurips.cc>',
  },
  {
    id: 'email-demo-accepted-4',
    project_id: 'demo-accepted',
    subject: 'NeurIPS 2025 Review — Paper #3847 (Reviewer tR8n)',
    sender: 'reviews@neurips.cc',
    received_at: '2026-05-01 08:15:00',
    email_type: 'review',
    ai_summary:
      '审稿人3评分6/8/6。认为方法有效但创新性中等，建议增加消融实验分析tau参数的影响，并讨论方法的局限性。',
    is_read: 1,
    is_important: 0,
    raw_content: `Paper #3847 Review

Rating: 6 (Marginally above acceptance threshold)
Confidence: 3 (Fairly confident)

Summary:
The paper presents ASA, combining importance scoring with Gumbel-Softmax for sparse attention. The method is effective but the novelty is moderate — the individual components (top-k attention, Gumbel-Softmax, learnable scoring) are well-known.

Strengths:
1. Solid experimental methodology
2. The combination of techniques is well-motivated
3. CUDA kernel is a nice practical contribution

Weaknesses:
1. Novelty is incremental — each component exists in prior work
2. Missing analysis of tau sensitivity
3. No discussion of failure cases or limitations

Questions:
1. Can you provide a tau sensitivity analysis?
2. In what scenarios does ASA underperform full attention significantly?
3. How does the importance scorer generalize to unseen domains?`,
    message_id: '<review-3847-tR8n@neurips.cc>',
  },
  {
    id: 'email-demo-accepted-5',
    project_id: 'demo-accepted',
    subject: 'NeurIPS 2025 Decision: Accept — Paper #3847',
    sender: 'decisions@neurips.cc',
    received_at: '2026-06-20 02:00:00',
    email_type: 'decision',
    ai_summary:
      '论文被NeurIPS 2025录用！平均评分6.67/10。Area Chair建议根据审稿意见做minor revision（补充FlashAttention对比和tau分析），Camera Ready截止7月15日。',
    is_read: 1,
    is_important: 1,
    raw_content: `Dear Authors,

We are pleased to inform you that your paper #3847 "Adaptive Sparse Attention for Efficient Long-Context Language Modeling" has been accepted to NeurIPS 2025.

Average Rating: 6.67/10
Decision: Accept

The reviewers recognized the practical value of your ASA method and the quality of your experimental work. The Area Chair recommends the following minor revisions for the camera-ready version:

1. Add comparison with FlashAttention-2 as suggested by Reviewer qvKp
2. Include tau sensitivity analysis as requested by Reviewer tR8n
3. Add error bars to Figure 2

Camera-ready deadline: July 15, 2026

Congratulations!
NeurIPS 2025 Program Committee`,
    message_id: '<decision-3847@neurips.cc>',
  },

  // ---- Project 2 (rejected): 3 emails ----
  {
    id: 'email-demo-rejected-1',
    project_id: 'demo-rejected',
    subject: 'CVPR 2025 Submission Received — Paper #5291',
    sender: 'cvpr2025@cvf.openconf.org',
    received_at: '2026-03-20 04:10:00',
    email_type: 'other',
    ai_summary: 'CVPR 2025投稿确认，论文编号#5291。',
    is_read: 1,
    is_important: 0,
    raw_content: `Dear Author,

Your submission to CVPR 2025 has been received.

Paper ID: 5291
Title: Diffusion-Guided Reinforcement Learning for Robotic Manipulation

Reviews will be released by May 10, 2026.

CVPR 2025 Organization`,
    message_id: '<cvpr2025-5291@cvf.org>',
  },
  {
    id: 'email-demo-rejected-2',
    project_id: 'demo-rejected',
    subject: 'CVPR 2025 Reviews Available — Paper #5291',
    sender: 'cvpr2025@cvf.openconf.org',
    received_at: '2026-05-10 06:00:00',
    email_type: 'review',
    ai_summary:
      '三位审稿人评分3/4/3。主要质疑：视觉任务表现不及DreamerV3、与DreamerV3对比不公平（不同编码器）、guidance_scale需手动调参。',
    is_read: 1,
    is_important: 1,
    raw_content: `Dear Author,

Reviews for your paper #5291 are now available.

Reviewer 1: 3 (Weak Reject)
"The diffusion policy approach is interesting but the method underperforms on vision-based tasks. The comparison with DreamerV3 uses different visual encoders, making it unfair."

Reviewer 2: 4 (Borderline)
"Solid work on guided diffusion for RL. The Q-value guidance is novel. However, the sensitivity to guidance_scale is concerning — the method requires per-task tuning."

Reviewer 3: 3 (Weak Reject)
"Sample efficiency gains are marginal on complex manipulation tasks. The DMControl experiments show the method is not competitive with world-model approaches."

Please wait for the final decision by May 15.

CVPR 2025`,
    message_id: '<cvpr2025-reviews-5291@cvf.org>',
  },
  {
    id: 'email-demo-rejected-3',
    project_id: 'demo-rejected',
    subject: 'CVPR 2025 Decision: Reject — Paper #5291',
    sender: 'cvpr2025@cvf.openconf.org',
    received_at: '2026-05-15 03:00:00',
    email_type: 'decision',
    ai_summary:
      '论文被CVPR 2025拒稿。Area Chair指出视觉任务表现不足是主要问题，建议转投专注RL的会议（如ICRA/CoRL），并加强state-based任务实验。',
    is_read: 1,
    is_important: 1,
    raw_content: `Dear Authors,

We regret to inform you that your paper #5291 "Diffusion-Guided Reinforcement Learning for Robotic Manipulation" has not been accepted to CVPR 2025.

Decision: Reject

The Area Chair notes: "While the Q-value guided diffusion idea is novel, the method's performance on vision-based tasks does not meet the standard for CVPR. The reviewers raised valid concerns about the fairness of the DreamerV3 comparison. The author may consider submitting to a robotics-focused venue (ICRA, CoRL) where state-based experiments would be more valued."

Average Rating: 3.33/5

We encourage you to address the reviewers' feedback and consider the suggestion for resubmission.

CVPR 2025 Program Committee`,
    message_id: '<cvpr2025-decision-5291@cvf.org>',
  },

  // ---- Project 3 (pending_revise): 4 emails ----
  {
    id: 'email-demo-revise-1',
    project_id: 'demo-revise',
    subject: 'ICML 2026 Submission Confirmation — Paper #1942',
    sender: 'noreply@icml.cc',
    received_at: '2026-05-10 02:45:00',
    email_type: 'other',
    ai_summary: 'ICML 2026投稿确认，论文编号#1942。',
    is_read: 1,
    is_important: 0,
    raw_content: `Dear Author,

Your ICML 2026 submission has been received.

Paper ID: 1942
Title: Federated Learning with Heterogeneous Edge Devices: A Queueing Theory Approach

Reviews will be available by June 25, 2026.

ICML 2026`,
    message_id: '<icml2026-1942@icml.cc>',
  },
  {
    id: 'email-demo-revise-2',
    project_id: 'demo-revise',
    subject: 'ICML 2026 Reviews — Paper #1942',
    sender: 'reviews@icml.cc',
    received_at: '2026-06-25 07:30:00',
    email_type: 'review',
    ai_summary:
      '评分5/6/5。审稿人肯定排队论视角的新颖性，但要求补充与FedNova对比、扩展非凸理论分析、澄清M/G/1模型假设的合理性。',
    is_read: 1,
    is_important: 1,
    raw_content: `Paper #1942 Reviews

Reviewer A (6/10): "The queueing theory perspective is a fresh take on federated learning. The AdaSync algorithm is well-motivated. However, missing comparison with FedNova. The non-convex analysis would strengthen the paper."

Reviewer B (5/10): "Interesting theoretical contribution. The M/G/1 model assumptions need better justification — real edge device arrival patterns may not be Poisson. Experiments are solid but limited."

Reviewer C (5/10): "The convergence bound is the main contribution but it's only for convex objectives. Please extend to non-convex setting. Figure 2 is hard to read."

Recommendation: Major revision with rebuttal.`,
    message_id: '<icml2026-reviews-1942@icml.cc>',
  },
  {
    id: 'email-demo-revise-3',
    project_id: 'demo-revise',
    subject: 'ICML 2026 Decision: Major Revision — Paper #1942',
    sender: 'decisions@icml.cc',
    received_at: '2026-07-01 04:00:00',
    email_type: 'revision',
    ai_summary:
      'ICML 2026给出Major Revision决定。需在8月15日前提交修改稿，具体要求：1) 补充FedNova对比 2) 扩展非凸收敛分析 3) 验证非Poisson到达下的鲁棒性 4) 改进Figure 2可读性。',
    is_read: 1,
    is_important: 1,
    raw_content: `Dear Authors,

Your paper #1942 has received a "Major Revision" decision for ICML 2026.

The reviewers and Area Chair have identified the following required revisions:

1. Add experimental comparison with FedNova and FedDyn
2. Extend the convergence analysis to the non-convex setting (Theorem 2)
3. Provide experiments or discussion on non-Poisson arrival patterns
4. Improve Figure 2 readability (consider log scale)
5. Clarify the practical deployment scenario

Revision deadline: August 15, 2026

Please submit your revised paper along with a detailed response to each reviewer comment.

ICML 2026 Program Committee`,
    message_id: '<icml2026-revision-1942@icml.cc>',
  },
  {
    id: 'email-demo-revise-4',
    project_id: 'demo-revise',
    subject: 'Reminder: ICML 2026 Revision Due August 15 — Paper #1942',
    sender: 'noreply@icml.cc',
    received_at: '2026-07-10 02:00:00',
    email_type: 'other',
    ai_summary: 'ICML返修提醒邮件，截止日期8月15日，剩余36天。',
    is_read: 0,
    is_important: 0,
    raw_content: `Dear Authors,

This is a reminder that the revision for your paper #1942 is due by August 15, 2026.

Remaining time: 36 days

Please ensure all reviewer comments are addressed in your response letter.

ICML 2026`,
    message_id: '<icml2026-reminder-1942@icml.cc>',
  },
];

// ============================================================================
//  LATEX PROJECT FILES (on disk)
// ============================================================================

const latexProjects = {
  'demo-accepted': {
    mainTex: `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{hyperref}
\\usepackage{neurips_2025}

\\title{Adaptive Sparse Attention for Efficient Long-Context Language Modeling}

\\author{
  Anonymous Authors\\\\
  Paper ID: 3847
}

\\begin{document}
\\maketitle

\\begin{abstract}
We present Adaptive Sparse Attention (ASA), a novel attention mechanism that reduces the computational cost of long-context language modeling while preserving model quality. ASA introduces a learnable importance scoring network that dynamically selects the most relevant attention connections per query, reducing complexity from $O(n^2)$ to $O(n \\cdot k)$ where $k \\ll n$. During training, we employ Gumbel-Softmax to maintain differentiability of the top-$k$ selection, while a custom CUDA kernel enables efficient hard top-$k$ selection during inference. Experiments on LongBench (14 tasks) and PG-19 demonstrate that ASA achieves 97.2\\% of full-attention quality while reducing inference latency by 3.2$\\times$ and memory usage by 58\\%.
\\end{abstract}

\\section{Introduction}
Transformer-based language models have achieved remarkable success across natural language processing tasks. However, the quadratic complexity of self-attention limits their applicability to long sequences. Existing sparse attention methods either use fixed patterns or non-differentiable top-$k$ selection, leading to suboptimal quality-efficiency trade-offs.

We propose Adaptive Sparse Attention (ASA), which addresses these limitations through three key innovations: (1) a learnable importance scoring network for query-aware sparse pattern selection, (2) differentiable top-$k$ via Gumbel-Softmax for end-to-end training, and (3) a dual forward path with custom CUDA kernels for efficient inference.

\\section{Related Work}
\\textbf{Efficient Attention.} Linear attention methods~\\cite{linear-attn} approximate the attention matrix to achieve linear complexity but often sacrifice quality. Sparse attention methods~\\cite{sparse-transformer,longformer} use predefined patterns, limiting adaptability.

\\textbf{Learnable Sparsity.} Recent work~\\cite{learnable-sparse} explores learnable sparse patterns but relies on hard selection, preventing gradient flow. Our Gumbel-Softmax approach enables differentiable training.

\\section{Method}

\\subsection{Importance Scoring Network}
Given input $X \\in \\mathbb{R}^{n \\times d}$, we compute an importance score for each position:
\\begin{equation}
  s = \\sigma(W_2 \\cdot \\text{GELU}(W_1 x + b_1) + b_2)
\\end{equation}
where $W_1 \\in \\mathbb{R}^{d/4 \\times d}$, $W_2 \\in \\mathbb{R}^{h \\times d/4}$.

\\subsection{Differentiable Top-$k$ via Gumbel-Softmax}
We combine the importance scores with standard attention scores and apply Gumbel-Softmax to produce a differentiable binary mask:
\\begin{equation}
  \\mathcal{M}_{i,j} = \\text{Gumbel-Softmax}(\\alpha \\cdot s_i \\cdot A_{i,j}, \\tau)
\\end{equation}
where $\\tau$ is the temperature and $\\alpha$ controls the sparsity strength.

\\subsection{Complexity Analysis}
\\begin{theorem}
The computational complexity of ASA is $O(n \\cdot k \\cdot d)$ where $n$ is the sequence length, $k$ is the number of selected positions, and $d$ is the head dimension. The memory complexity is $O(n \\cdot k)$.
\\end{theorem}

\\section{Experiments}

\\subsection{Setup}
We evaluate ASA on LongBench (14 tasks spanning QA, summarization, and retrieval) and PG-19 (language modeling perplexity). We compare against full attention and FlashAttention-2.

\\subsection{Main Results}

\\begin{table}[h]
\\centering
\\caption{LongBench results (avg score, higher is better).}
\\label{tab:longbench}
\\begin{tabular}{lccccc}
\\toprule
Method & Avg Score & Latency (ms) & Memory (GB) & Speedup \\\\
\\midrule
Full Attention & 67.1 & 142.3 & 20.1 & 1.0$\\times$ \\\\
FlashAttention-2 & 66.8 & 68.5 & 14.2 & 2.1$\\times$ \\\\
ASA-Base ($k$=64) & 65.3 & 44.2 & 8.4 & 3.2$\\times$ \\\\
ASA-Large ($k$=64) & 66.8 & 52.1 & 12.7 & 2.7$\\times$ \\\\
\\bottomrule
\\end{tabular}
\\end{table}

\\subsection{Ablation Study}
Table~\\ref{tab:ablation} shows the contribution of each component.

\\begin{table}[h]
\\centering
\\caption{Ablation on PG-19 (perplexity, lower is better).}
\\begin{tabular}{lc}
\\toprule
Configuration & PPL \\\\
\\midrule
Full Attention & 10.42 \\\\
ASA w/o Scorer & 11.42 \\\\
ASA w/ Hard Top-$k$ & 11.15 \\\\
ASA w/ Gumbel-Softmax & \\textbf{10.87} \\\\
\\bottomrule
\\end{tabular}
\\end{table}

\\section{Conclusion}
We presented ASA, an adaptive sparse attention mechanism that achieves significant speedups with minimal quality loss. The learnable importance scorer and differentiable top-$k$ selection enable effective training, while the custom CUDA kernel ensures fast inference.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}
`,
    references: `@article{linear-attn,
  title={Linear Attention Is Secretly Fast Weight Programmers},
  author={Schlag, Iman and Irie, Kazuki and Schmidhuber, J{\"u}rgen},
  journal={ICML},
  year={2021}
}

@article{sparse-transformer,
  title={Generating Long Sequences with Sparse Transformers},
  author={Child, Rewon and Gray, Scott and Radford, Alec and Sutskever, Ilya},
  journal={arXiv preprint arXiv:1904.10509},
  year={2019}
}

@inproceedings{longformer,
  title={Longformer: The Long-Document Transformer},
  author={Beltagy, Iz and Peters, Matthew E and Cohan, Arman},
  booktitle={ACL},
  year={2020}
}

@article{learnable-sparse,
  title={Learning Sparse Attention via Entropy Regularization},
  author={Wang, Sinong and Li, Belinda and Khabsa, Madian},
  journal={NeurIPS},
  year={2023}
}

@article{flashattention2,
  title={FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning},
  author={Dao, Tri},
  journal={ICLR},
  year={2024}
}

@misc{longbench,
  title={LongBench: A Bilingual, Multitask Benchmark for Long Context Understanding},
  author={Bai, Yushi and others},
  year={2023}
}

@misc{pg19,
  title={PG-19: A Large-Scale Benchmark for Evaluating Long-Form Language Modelling},
  author={Rae, Jack W and others},
  year={2019}
}
`,
  },

  'demo-rejected': {
    mainTex: `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{hyperref}

\\title{Diffusion-Guided Reinforcement Learning for Robotic Manipulation}

\\author{Anonymous Authors \\\\ Paper ID: 5291}

\\begin{document}
\\maketitle

\\begin{abstract}
We introduce DiffRL, a reinforcement learning framework that leverages diffusion models as policy priors for robotic manipulation tasks. Our key insight is that diffusion models can generate diverse, high-quality exploration trajectories, which can be guided toward high-value regions using Q-function gradients. We propose a Q-value guided diffusion policy that combines classifier-free guidance with off-policy RL training. Experiments on MetaWorld demonstrate that DiffRL achieves 84\\% success rate with 40\\% fewer training episodes compared to SAC. However, performance on vision-based DMControl tasks remains limited compared to world-model approaches.
\\end{abstract}

\\section{Introduction}
Reinforcement learning for robotic manipulation suffers from low sample efficiency, primarily due to ineffective exploration. Diffusion models, which have shown remarkable success in image generation, offer a promising approach for learning multi-modal action distributions.

We propose DiffRL, which uses a diffusion model as a policy network and guides the sampling process using Q-value gradients. This combines the expressive power of diffusion models with the goal-directedness of Q-learning.

\\section{Method}

\\subsection{Diffusion Policy}
We model the policy as a conditional diffusion model. Given state $s$, the policy generates action $a$ by iteratively denoising:
\\begin{equation}
  a_{t-1} = a_t - \\beta_t \\nabla_{a_t} \\log p(a_t | s) + \\sqrt{\\beta_t} \\epsilon
\\end{equation}
where $\\epsilon \\sim \\mathcal{N}(0, I)$.

\\subsection{Q-Value Guidance}
During sampling, we modify the denoising process to bias toward high-Q actions:
\\begin{equation}
  \\tilde{\\epsilon} = \\epsilon - \\gamma \\sigma_t \\nabla_{a_t} Q(s, a_t)
\\end{equation}
where $\\gamma$ is the guidance scale.

\\section{Experiments}

\\subsection{MetaWorld}
We evaluate on 50 MetaWorld tasks using state observations.

\\begin{table}[h]
\\centering
\\caption{MetaWorld success rates (\%).}
\\begin{tabular}{lccc}
\\toprule
Method & Reach & Push & Pick \\\\
\\midrule
SAC & 89 & 65 & 60 \\\\
DiffRL & 92 & 74 & 68 \\\\
DiffRL + Guidance & \\textbf{96} & \\textbf{84} & \\textbf{79} \\\\
\\bottomrule
\\end{tabular}
\\end{table}

\\subsection{DMControl}
We also evaluate on 6 DMControl tasks with image observations.

\\begin{table}[h]
\\centering
\\caption{DMControl episode returns.}
\\begin{tabular}{lcc}
\\toprule
Task & DreamerV3 & DiffRL \\\\
\\midrule
Cheetah-run & 812 & 673 \\\\
Walker-walk & 745 & 521 \\\\
\\bottomrule
\\end{tabular}
\\end{table}

\\section{Conclusion}
DiffRL demonstrates that diffusion-guided policies can improve sample efficiency in state-based RL. However, performance on vision-based tasks requires further investigation, potentially through integration with world models.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}
`,
    references: `@article{ddpm,
  title={Denoising Diffusion Probabilistic Models},
  author={Ho, Jonathan and Jain, Ajay and Abbeel, Pieter},
  journal={NeurIPS},
  year={2020}
}

@article{sac,
  title={Soft Actor-Critic: Off-Policy Maximum Entropy Deep Reinforcement Learning with a Stochastic Actor},
  author={Haarnoja, Tuomas and others},
  journal={ICML},
  year={2018}
}

@article{diffuser,
  title={Planning with Diffusion for Flexible Behavior Synthesis},
  author={Janner, Michael and others},
  journal={ICML},
  year={2022}
}

@article{dreamerv3,
  title={Mastering Diverse Domains through World Models},
  author={Hafner, Danijar and others},
  journal={arXiv preprint},
  year={2023}
}

@misc{metaworld,
  title={MetaWorld: A Benchmark and Evaluation for Multi-Task and Meta Reinforcement Learning},
  author={Yu, Tianhe and others},
  year={2019}
}
`,
  },

  'demo-revise': {
    mainTex: `\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{algorithm}
\\usepackage{algpseudocode}
\\usepackage{hyperref}

\\title{Federated Learning with Heterogeneous Edge Devices: A Queueing Theory Approach}

\\author{Anonymous Authors \\\\ Paper ID: 1942}

\\begin{document}
\\maketitle

\\begin{abstract}
We study federated learning systems where edge devices have heterogeneous computing capabilities, causing straggler effects that bottleneck global aggregation. We model the device participation as an M/G/1 queue and derive the relationship between device heterogeneity, aggregation delay, and convergence rate. Based on this analysis, we propose AdaSync, an adaptive device scheduling algorithm that dynamically adjusts the number of participating devices based on queue backlog. We provide theoretical convergence guarantees showing that AdaSync achieves $O(1/\\sqrt{T})$ convergence with bounded delay. Experiments on CIFAR-10 and FEMNIST demonstrate that AdaSync reduces average round delay by 51\\% and improves convergence speed by 1.8$\\times$ compared to FedAvg.
\\end{abstract}

\\section{Introduction}
Federated learning enables collaborative model training across distributed devices without sharing raw data. However, real-world edge deployments face significant heterogeneity in device computing capabilities, leading to the straggler problem where slow devices delay each aggregation round.

\\section{Queueing Model}

We model each device as an M/G/1 queue where training jobs arrive as a Poisson process with rate $\\lambda$ and service times follow a general distribution with mean $1/\\mu_i$ and variance $\\sigma_i^2$ for device $i$.

\\begin{theorem}[Expected Delay]
The expected waiting time for device $i$ is:
\\begin{equation}
  E[W_i] = \\frac{\\rho_i}{1 - \\rho_i} \\cdot \\frac{1 + CV_i^2}{2 \\mu_i}
\\end{equation}
where $\\rho_i = \\lambda / \\mu_i$ is the utilization and $CV_i = \\sigma_i \\mu_i$ is the coefficient of variation.
\\end{theorem}

\\section{AdaSync Algorithm}

\\begin{algorithm}[h]
\\caption{AdaSync: Adaptive Device Scheduling}
\\begin{algorithmic}[1]
\\State \\textbf{Input:} devices $\\mathcal{D}$, max participants $k_{max}$, learning rate $\\eta$
\\For{round $t = 1, 2, \\ldots, T$}
  \\State Compute backlog $b_t = \\sum_{i \\in \\mathcal{D}} |Q_i|$
  \\State Set $k_t = \\max(1, k_{max} - b_t)$
  \\State Select $k_t$ devices with lowest expected delay
  \\State Perform local training on selected devices
  \\State Aggregate updates: $w_{t+1} = w_t - \\eta \\sum_{i \\in S_t} \\frac{n_i}{n} \\nabla F_i(w_t)$
\\EndFor
\\end{algorithmic}
\\end{algorithm}

\\begin{theorem}[Convergence]
Under $L$-smoothness and bounded variance $\\sigma^2$, after $T$ rounds:
\\begin{equation}
  E[F(w_T) - F^*] \\leq \\left(1 - \\frac{\\eta L k}{n}\\right)^T \\Delta_0 + \\frac{\\sigma^2 \\eta}{2 k}
\\end{equation}
where $\\Delta_0 = F(w_0) - F^*$.
\\end{theorem}

\\section{Experiments}

\\begin{table}[h]
\\centering
\\caption{CIFAR-10 non-IID ($\\alpha=0.1$) results.}
\\label{tab:cifar}
\\begin{tabular}{lccc}
\\toprule
Method & Test Acc (\\%) & Convergence Round & Avg Delay (s) \\\\
\\midrule
FedAvg & 68.2 & 180 & 47.2 \\\\
FedProx & 70.1 & 155 & 45.8 \\\\
AdaSync & \\textbf{73.8} & \\textbf{98} & \\textbf{23.1} \\\\
\\bottomrule
\\end{tabular}
\\end{table}

\\section{Conclusion}
We presented a queueing-theoretic analysis of federated learning with heterogeneous devices and proposed AdaSync for adaptive scheduling. Our theoretical and empirical results demonstrate significant improvements in convergence speed and delay reduction.

\\bibliographystyle{plain}
\\bibliography{references}

\\end{document}
`,
    references: `@inproceedings{fedavg,
  title={Communication-Efficient Learning of Deep Networks from Decentralized Data},
  author={McMahan, Brendan and others},
  booktitle={AISTATS},
  year={2017}
}

@inproceedings{fedprox,
  title={Federated Optimization in Heterogeneous Networks},
  author={Li, Tian and others},
  booktitle={MLSys},
  year={2020}
}

@article{fednova,
  title={FedNova: Non-Biased Federated Learning with Normative Updates},
  author={Wang, Jianyu and others},
  journal={ICLR},
  year={2021}
}

@book{queueing-theory,
  title={Fundamentals of Queueing Theory},
  author={Gross, Donald and Shortle, John F and Thompson, James M},
  year={2008},
  publisher={Wiley}
}

@misc{cifar10,
  title={Learning Multiple Layers of Features from Tiny Images},
  author={Krizhevsky, Alex},
  year={2009}
}

@misc{femnist,
  title={Leaf: A benchmark for federated settings},
  author={Caldas, Sebastian and others},
  year={2019}
}
`,
  },
};

// ============================================================================
//  DATABASE FUNCTIONS
// ============================================================================

function clearBusinessData(db) {
  console.log('  Clearing existing business data...');
  // Delete in dependency order (children first)
  db.exec('DELETE FROM emails');
  db.exec('DELETE FROM latex_versions');
  db.exec('DELETE FROM experiments');
  db.exec('DELETE FROM code_versions');
  db.exec('DELETE FROM progress_nodes');
  db.exec('DELETE FROM submission_branches');
  db.exec("DELETE FROM projects WHERE status = 'active'");
  // Clear email config but keep llm_config
  db.exec("DELETE FROM email_config");
  db.exec("DELETE FROM git_config WHERE default_repo_path != ''");
  console.log('  Business data cleared (llm_config preserved).');
}

function insertProject(db, p) {
  db.prepare(
    `INSERT INTO projects (id, title, description, target_venue, tags, phase, created_at, updated_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    p.id, p.title, p.description, p.target_venue,
    JSON.stringify(p.tags), p.phase, p.created_at, p.updated_at, p.status,
  );
}

function insertProgressNode(db, n) {
  db.prepare(
    `INSERT INTO progress_nodes (id, project_id, phase, label, status, order_index, parent_branch_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    n.id, n.project_id, n.phase, n.label, n.status, n.order_index,
    n.parent_branch_id, n.created_at || '2026-01-01 00:00:00', n.updated_at || '2026-01-01 00:00:00',
  );
}

function insertSubmissionBranch(db, b) {
  db.prepare(
    `INSERT INTO submission_branches (id, project_id, label, target_venue, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(b.id, b.project_id, b.label, b.target_venue, b.status, b.created_at);
}

function insertCodeVersion(db, v) {
  db.prepare(
    `INSERT INTO code_versions (id, project_id, version_label, ai_summary, timestamp, git_commit_hash, diff_text, tags, file_content)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    v.id, v.project_id, v.version_label, v.ai_summary, v.timestamp,
    v.git_commit_hash, v.diff_text,
    v.tags ? JSON.stringify(v.tags) : null, v.file_content,
  );
}

function insertExperiment(db, e) {
  db.prepare(
    `INSERT INTO experiments (id, project_id, name, experiment_type, dataset, model, hyperparameters, metrics, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    e.id, e.project_id, e.name, e.experiment_type, e.dataset, e.model,
    e.hyperparameters ? JSON.stringify(e.hyperparameters) : null,
    e.metrics ? JSON.stringify(e.metrics) : null,
    e.notes, e.status, e.created_at,
  );
}

function insertLatexVersion(db, v) {
  db.prepare(
    `INSERT INTO latex_versions (id, project_id, version_label, ai_summary, timestamp, git_commit_hash)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(v.id, v.project_id, v.version_label, v.ai_summary, v.timestamp, v.git_commit_hash);
}

function insertEmail(db, e) {
  db.prepare(
    `INSERT INTO emails (id, project_id, subject, sender, received_at, email_type, ai_summary, is_read, is_important, raw_content, message_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    e.id, e.project_id, e.subject, e.sender, e.received_at,
    e.email_type, e.ai_summary, e.is_read, e.is_important,
    e.raw_content, e.message_id,
  );
}

// ============================================================================
//  LATEX FILE CREATION
// ============================================================================

function createLatexProject(projectId, content) {
  const dir = join(LATEX_STORAGE, projectId);
  // Clean existing directory
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, 'figures'), { recursive: true });

  // Write main.tex
  writeFileSync(join(dir, 'main.tex'), content.mainTex, 'utf-8');
  // Write references.bib
  writeFileSync(join(dir, 'references.bib'), content.references, 'utf-8');
  // Write .paperpilot.json config
  writeFileSync(
    join(dir, '.paperpilot.json'),
    JSON.stringify({ mainFile: 'main.tex' }, null, 2),
    'utf-8',
  );

  console.log(`  LaTeX project created: ${dir}`);
}

// ============================================================================
//  MAIN
// ============================================================================

function main() {
  console.log('PaperPilot Demo Data Seed Script');
  console.log('================================\n');

  console.log(`Database: ${DB_PATH}`);
  console.log(`LaTeX storage: ${LATEX_STORAGE}\n`);

  if (!existsSync(DB_PATH)) {
    console.error('ERROR: Database file not found. Run the app once to initialize it.');
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma('journal_mode = MEMORY');

  // === Clear and insert data ===
  const seedTransaction = db.transaction(() => {
    clearBusinessData(db);

    console.log('\n  Inserting projects...');
    projects.forEach((p) => insertProject(db, p));
    console.log(`    ${projects.length} projects inserted.`);

    console.log('  Inserting progress nodes...');
    progressNodes.forEach((n) => insertProgressNode(db, n));
    console.log(`    ${progressNodes.length} progress nodes inserted.`);

    console.log('  Inserting submission branches...');
    submissionBranches.forEach((b) => insertSubmissionBranch(db, b));
    console.log(`    ${submissionBranches.length} branches inserted.`);

    console.log('  Inserting code versions...');
    codeVersions.forEach((v) => insertCodeVersion(db, v));
    console.log(`    ${codeVersions.length} code versions inserted.`);

    console.log('  Inserting experiments...');
    experiments.forEach((e) => insertExperiment(db, e));
    console.log(`    ${experiments.length} experiments inserted.`);

    console.log('  Inserting LaTeX versions...');
    latexVersions.forEach((v) => insertLatexVersion(db, v));
    console.log(`    ${latexVersions.length} LaTeX versions inserted.`);

    console.log('  Inserting emails...');
    emails.forEach((e) => insertEmail(db, e));
    console.log(`    ${emails.length} emails inserted.`);
  });

  seedTransaction();

  // === Create LaTeX project files ===
  console.log('\n  Creating LaTeX project files...');
  Object.entries(latexProjects).forEach(([id, content]) => {
    createLatexProject(id, content);
  });

  // === Summary ===
  console.log('\n================================');
  console.log('Demo data seeded successfully!\n');
  console.log('Summary:');
  console.log(`  Projects:          ${projects.length}`);
  console.log(`  Progress nodes:    ${progressNodes.length}`);
  console.log(`  Submission branches: ${submissionBranches.length}`);
  console.log(`  Code versions:     ${codeVersions.length}`);
  console.log(`  Experiments:       ${experiments.length}`);
  console.log(`  LaTeX versions:    ${latexVersions.length}`);
  console.log(`  Emails:            ${emails.length}`);
  console.log(`  LaTeX projects:    ${Object.keys(latexProjects).length} (on disk)`);
  console.log('\nProjects:');
  projects.forEach((p) => {
    console.log(`  [${p.phase.padEnd(14)}] ${p.title.substring(0, 60)}... → ${p.target_venue}`);
  });

  db.close();

  // Exit when run via Electron runner
  if (process.versions.electron) {
    setTimeout(() => process.exit(0), 500);
  }
}

main();
