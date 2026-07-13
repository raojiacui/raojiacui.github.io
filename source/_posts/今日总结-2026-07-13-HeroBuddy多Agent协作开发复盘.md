---
title: 今日总结-2026-07-13-HeroBuddy多Agent协作开发复盘
date: 2026-07-13 23:30:00
tags:
  - 工作总结
  - HeroBuddy
  - Codex
  - 多Agent协作
  - AI编程
  - MCP
  - Skills
categories:
  - 工作记录
description: 今天用主 Agent 加多个 Worker Agent 的方式推进 HeroBuddy MVP，从运行主循环、Provider 协议、工具安全、Session、Checkpoint、Context Budget，到 CLI Smoke 和 MCP/Skills 设计，完整体验了一次多 Agent 并行开发、审查、返工和合并流程。
---

# 今天第一次真实体验了多 Agent 协作开发

今天 HeroBuddy 的开发方式挺有意思：不再是一个 AI Agent 从头写到尾，而是把它当成一个小团队来用。

我像项目负责人一样，先让主 Agent 看完整个项目，拆模块、写文档、定验收标准，然后让多个 Worker Agent 分别在自己的分支上开发。最后再由主 Agent 审查、跑测试、要求返工、合并到集成分支。

多 Agent 协作方式感觉大大提高了干活的效率

## 一、今天的目标

HeroBuddy 是一个本地 AI 编程助手，目标不是简单调用大模型，而是逐步做成一个能安全读写项目、执行工具、保留上下文、支持回滚，并最终接入 MCP 和 Skills 的开发伙伴。

今天是在补 MVP 的底层骨架：

```text
Agent 主循环
Provider 协议
工具调用
审批策略
Workspace 安全
Session 记录
Checkpoint 回滚
Context Budget
CLI Smoke
MCP / Skills 设计
```

虽然这些东西用户表面上看不太出来，但它们决定了后面 HeroBuddy 能不能真的长期工作。

## 二、今天的多 Agent 分工

今天把任务拆成了 A 到 H 8个 worker：

```text
A：runtime-events
B：provider-protocol
C：policy-approvals
D：tools-workspace
E：storage-checkpoints
F：context-budget
G：e2e-smoke
H：mcp-skills-design
```

每个 worker 都在自己的分支上开发，主 Agent 不直接相信它们的结论，而是做几件事：

1. 看 diff
2. 跑测试
3. 找边界问题
4. 要求返工
5. 再审查
6. 最后合并

这个流程和真人团队开发很像。区别是 worker 都是 AI，速度很快，但也会犯很典型的工程错误。

## 三、返工其实很正常

今天有几个 worker 被打回返工。

比如 D 做 workspace 工具安全时，读文件、列文件、搜索文件已经会避开 `.git`、`.herobuddy` 这些目录，但写文件路径一开始没有完全走同一套安全门禁。也就是说，读是安全的，写却可能绕过去。

这个问题如果不审查，后面就会变成很危险的漏洞。

E 的问题更像流程问题：代码曾经在 stash 里，而且混了别的 worker 的改动。这个不是功能能力问题，而是交付形态不合格。多 Agent 开发里，交付必须是干净分支、干净 commit，不能用 stash 当成果。

H 也返工了一次。它做 MCP 和 Skills 的设计与 skeleton，测试本来是过的，但手工边界检查发现两个问题：

```text
1. SKILL.md 的 front matter 不支持 Windows CRLF
2. skill trigger 匹配太宽，review 会误匹配 preview
```

这两个问题现在看起来很小，但 Skills 系统一旦接入主流程，就会放大成误触发和上下文污染。所以提前修掉是值得的。

## 四、今天真正完成了什么

今天最后 A-H 都合进了 `feat/mvp`。

比较重要的新增能力包括：

### 1. 工具安全加固

HeroBuddy 现在对 workspace 有更明确的安全边界：

- 防止路径逃逸
- 防止读写敏感文件
- 跳过 `.git`、`.herobuddy`、`node_modules` 等目录
- 写入前生成 diff
- 写入类操作走审批策略
- command 执行有超时和输出截断

这个能力非常关键。Agent 如果能写文件，就必须先学会“不该写什么”。

### 2. Session 和 Checkpoint

今天加上了 session 记录和 checkpoint 回滚。

这意味着 HeroBuddy 不只是一次性执行命令，而是开始有“记忆”和“撤销能力”：

```text
用户输入
工具调用
审批记录
写入前快照
输出结果
停止原因
```

这些都可以进入 session。写文件前生成 checkpoint，后面可以 rewind。

### 3. Context Budget

上下文预算也补上了。

Agent 工作久了以后，历史消息、工具结果、文件引用都会越来越长。如果不压缩，prompt 很快就会失控。

今天加的 Context Budget 做了几件事：

- 解析 `@文件` 引用
- 支持中文路径和带空格路径
- 控制引用内容长度
- 压缩旧对话
- 保留最近消息
- 避免敏感内容进入 prompt

这一步是后面 Skills 能用起来的前提。

### 4. CLI E2E Smoke

今天还加了一个端到端 smoke 脚本，验证 fake provider 下的真实 CLI 路径：

```text
ask
ask --continue
ask --resume
chat /resume
chat /rewind
read_file
write_file
audit
session
checkpoint
context budget
```

这一步很重要，因为单元测试只能说明局部功能对，smoke 才能说明几个模块合在一起没有互相打架。

### 5. MCP / Skills 设计和骨架

今天没有直接做完整 MCP，也没有做完整 Skills 系统，而是先写了设计文档和最小 skeleton。

这点我觉得是对的。

MCP 和 Skills 都是会影响权限、安全、上下文和工具调用的大模块。如果一上来就完整实现，很容易变成“能跑但不安全”。

现在先把边界定清楚：

```text
MCP tool 不能绕过 policy / approval / audit / session
Skills 只能提供上下文和流程建议，不能授予权限
unknown effect 默认 fail closed
skill 注入必须受 context budget 控制
```

这样后面实现时就不会乱。

## 五、最终验证结果

今天最后的集成分支是：

```text
feat/mvp
```

最终验证结果：

```text
python -m unittest -v
58 tests OK, 1 skipped

python scripts/check_compat.py
passed

python scripts/smoke_cli.py
passed

git diff --check
passed
```

最后把今天成果推到了远端：

```text
origin/feat/mvp
```

没有直接推 `main`。现在 `main` 还是稳定基线，`feat/mvp` 是当前 MVP 集成线。

## 六、这套协作方式的优点

今天最大的感受是：多 Agent 协作确实能提高开发速度。

一个 Agent 做全部事情时，很容易上下文太长，也容易陷入一个模块里反复修。拆成多个 worker 后，每个 worker 只关心自己的模块，速度明显快很多。

但真正让它有效的不是“开很多窗口”，而是主 Agent 要像负责人一样做管理：

```text
拆任务
定边界
写验收标准
审查 diff
跑测试
要求返工
控制合并顺序
```

否则多个 Agent 只会同时制造混乱。

## 七、今天学到的流程经验

今天也暴露出一些流程问题。

一开始给 worker 的约束还不够硬，比如只说“做 workspace 安全”，但没有明确说：

```text
read_file / write_file / replace_text / move_path / delete_path
必须共用同一套路径门禁
```

结果 worker 做了大方向，但漏了危险边界。

后面我意识到，多 Agent 任务不能写成普通需求，而要写成工程合同：

```text
你能改哪些文件
你不能改哪些文件
必须补哪些测试
必须跑哪些命令
最终报告格式是什么
不能用 stash 交付
git status 必须干净
```

这套规则一旦清楚，返工就会少很多。

## 八、明天准备做什么

今天已经把 MVP 骨架收口到一个比较稳定的状态。

明天计划开始把 MCP 和 Skills 从设计推进到最小可用：

```text
Skills v0：本地 SKILL.md discovery、选择、prompt 注入
MCP v0：fake/local adapter、tool schema 注册、fail-closed policy
CLI / doctor / smoke：把 MCP 和 Skills 状态纳入检查
```

但明天不应该一上来就做完整 MCP client，也不应该急着支持真实 server 管理。先做本地 fake adapter 和稳定测试路径更合理。

## 九、总结

今天的开发不像是在“写一个功能”，更像是在搭一个 AI 工程团队的工作方式。

HeroBuddy 的代码在进步，但更重要的是开发流程也在成型：

```text
主 Agent 负责架构、审查和合并
Worker Agent 负责局部实现
测试和 smoke 作为合并门禁
文档记录下一步计划
```

这种方式很适合做模块比较清晰，依赖性不强的项目。因为它本身就是一个 Agent 工具，而开发它的过程，也刚好可以用 Agent 协作来验证未来的使用方式

今天算是一个很好的节点：MVP 骨架基本站起来了，明天可以开始往 MCP 和 Skills 走。
