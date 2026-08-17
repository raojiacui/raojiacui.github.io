---
title: 从零搭建一台 AI Agent Windows 11 虚拟机
date: 2026-08-17 20:00:00
tags:
  - AI Agent
  - Windows 11
  - VirtualBox
  - Codex
  - Claude Code
  - Playwright
categories: 学习笔记
---

这次记录的是从一台已经安装 Oracle VirtualBox 的 Windows 电脑开始，搭建一套独立 AI Agent 实验环境的完整过程。

这套环境的目标不是把所有工具都装到日常电脑里，而是单独准备一台 Windows 11 虚拟机，把 Codex App、Claude Code、OpenCode、Playwright CLI、Hermes、AITDK 等工具集中放进去。

原因很简单：Agent 能力越来越强，能读文件、跑命令、打开浏览器、自动点击网页。如果直接放在真实电脑里，它理论上可能接触到私人文件、Token、SSH Key、`.env`、浏览器登录态，甚至误删或改坏一些不该碰的东西。

所以这次的核心思路是：

> 先自己看懂问题，再让 Agent 自动化，最后由自己检查和验收结果。

## 1. 最终想搭成什么样

最终环境大概是这样：

```text
真实 Windows 电脑
│
├── 日常文件
├── 项目
├── 浏览器
├── 代理软件
│
└── Oracle VirtualBox
     │
     └── Windows 11 虚拟机
          │
          ├── Chrome
          ├── Git
          ├── Node.js + npm
          ├── ChatGPT / Codex
          ├── OpenCode
          ├── Playwright CLI
          ├── Claude Code
          ├── Hermes
          └── AITDK
```

后面的自动化任务链路则是：

```text
微信
 ↓
Hermes
 ↓
OpenCode / Claude Code / Codex
 ↓
Playwright CLI
 ↓
浏览器自动执行任务
 ↓
CSV / 文件 / 调研结果
```

这台 VM 本质上就是一台低成本 AI 实验电脑。

## 2. 为什么要单独建虚拟机

如果所有 Agent 工具都运行在日常电脑环境里，它们可能碰到很多完全不需要碰的东西。

比如：

- 私人文件
- 浏览器 Cookie
- SSH Key
- API Token
- 项目里的 `.env`
- 真实工作目录

Agent 不是一定会乱动，但一旦工具权限给得太宽，它就有机会误操作。

所以更合理的做法是：专门准备一台“AI 实验电脑”。虚拟机出问题，影响基本也限制在虚拟机内部。

## 3. 创建 Windows 11 虚拟机

我的宿主机配置是：

```text
内存：32GB
CPU：14 核 / 14 逻辑处理器
VirtualBox：7.2.12
```

最后给虚拟机的配置是：

```text
Memory：8192 MB
Processors：4
Disk Size：100 GB
EFI：开启
```

这个配置目前足够运行：

```text
Windows 11
Chrome
Codex
OpenCode
Claude Code
Playwright
Hermes
```

Windows 11 ISO 建议直接使用微软官方的 x64 ISO，不要下载 ARM64，也不要解压 ISO。VirtualBox 可以直接挂载。

新建 VM 时取名：

```text
AI-Agent-Windows11
```

虚拟硬盘最好放在空间比较充足的位置，比如：

```text
D:\VirtualBox VMs\AI-Agent-Windows11\
```

不要默认全塞进 C 盘。

## 4. VirtualBox 创建 VM 的关键设置

VirtualBox 创建 Windows 11 虚拟机时，有几个地方需要注意。

第一个是取消无人值守安装：

```text
☐ Proceed with unattended installation
```

取消以后，Windows 会走微软自己的标准安装流程。这样如果卡住或报错，更容易判断问题到底出在哪里。

第二个是 EFI：

```text
☑ Use EFI
```

Windows 11 保持开启即可。

## 5. 安装 Windows 11

启动虚拟机以后，就是普通 Windows 安装流程。

中间可能会提示：

```text
我同意将删除所有内容，包括文件、应用和设置
```

这里删除的是虚拟机里的虚拟硬盘，不是宿主机真实的 C 盘或 D 盘。

所以全新 VM 可以正常选择。

## 6. 第一次初始化最容易卡在更新

Windows 11 第一次 OOBE 初始化时，我遇到过：

```text
正在获取最新功能和安全更新
步骤 1/3
下载 100%
```

然后长时间停在那里，后来甚至出现黑屏。

这种时候不要一看到不动就疯狂 Reset。第一次初始化可能同时在做这些事：

- 下载更新
- 安装驱动
- 配置组件
- 重启
- 初始化账户

虚拟机只有 4 核 + 8GB，速度自然比宿主机慢。

如果界面允许选择“稍后更新”，我更倾向于先跳过。目标应该是先进入 Windows 桌面，真正的 Windows Update 可以进桌面以后再慢慢完成。

## 7. VirtualBox 鼠标被捕获怎么办

第一次用 VirtualBox 时，很容易遇到鼠标突然消失。

其实不是系统坏了，而是鼠标被 VirtualBox 捕获了。

默认 Host Key 是：

```text
Right Ctrl
```

也就是键盘右边的 Ctrl。

按一下右 Ctrl，鼠标就会从 VM 释放出来。

## 8. 安装 VirtualBox Guest Additions

Windows 进入桌面以后，建议马上安装 Guest Additions。

VirtualBox 顶部菜单：

```text
Devices
→ Insert Guest Additions CD Image
```

然后在 Windows 里打开：

```text
文件资源管理器
→ 此电脑
→ VirtualBox Guest Additions
```

里面会看到：

```text
VBoxWindowsAdditions.exe
VBoxWindowsAdditions-amd64.exe
VBoxWindowsAdditions-arm64.exe
VBoxWindowsAdditions-x86.exe
```

普通 Intel / AMD 64 位 Windows 11 对应 `amd64`，直接运行 `VBoxWindowsAdditions.exe` 也可以，它会自动选择正确架构。

安装过程中如果出现黑屏几秒、分辨率变化、鼠标短暂失效、窗口闪烁，先等，不要立刻 Reset。

安装完成以后正常重启。

## 9. 开启双向剪贴板

Guest Additions 装好以后，开启：

```text
Devices
→ Shared Clipboard
→ Bidirectional
```

也可以开启：

```text
Devices
→ Drag and Drop
→ Bidirectional
```

这样就可以在宿主机和虚拟机之间直接复制命令。

## 10. BitLocker 的坑

Windows 11 登录 Microsoft 账号后，系统有时会自动启用：

```text
Device Encryption / BitLocker
```

我后来创建 VirtualBox 快照，再启动 VM 时，Windows 突然进入 BitLocker Recovery，提示大意是：

```text
Secure Boot policy unexpectedly changed
```

然后要求输入 48 位 BitLocker Recovery Key。

最后需要到：

```text
https://aka.ms/myrecoverykey
```

使用该 Windows 11 登录的 Microsoft 账号找到恢复密钥，再输入虚拟机完成恢复。

对于专门用来做 Agent 实验、频繁改环境的 VM，我后来决定不再折腾快照。

如果一定要大量使用快照，最好提前理解 BitLocker、虚拟 TPM 和 Secure Boot 的关系。

## 11. 虚拟机能上网，却打不开 ChatGPT

VirtualBox 默认网络一般使用 NAT。

虚拟机可以通过宿主机访问互联网，但要注意：

> VirtualBox NAT 不等于自动继承宿主机代理。

我一开始碰到的现象是：

```text
百度可以访问
ChatGPT 登录提示地区不支持
winget 下载 Chrome 超时
```

PowerShell 检查：

```powershell
netsh winhttp show proxy
```

结果显示：

```text
Direct access
```

也就是说，虚拟机根本没有走代理。

## 12. 让虚拟机走宿主机代理

宿主机代理端口是：

```text
7897
```

一开始我在虚拟机 Windows 代理里错误地填了：

```text
127.0.0.1:7897
```

这是错的。

因为 `127.0.0.1` 在虚拟机里代表的是虚拟机自己，不是宿主机。

VirtualBox 默认 NAT 下，虚拟机访问宿主机通常可以使用：

```text
10.0.2.2
```

所以最终代理配置成：

```text
地址：10.0.2.2
端口：7897
```

同时宿主机代理软件需要开启：

```text
Allow LAN
```

然后测试：

```powershell
Test-NetConnection 10.0.2.2 -Port 7897
```

看到：

```text
TcpTestSucceeded : True
```

说明链路已经打通：

```text
虚拟机
↓
VirtualBox NAT
↓
10.0.2.2
↓
宿主机代理
↓
互联网
```

这一步解决以后，Google、ChatGPT、GitHub、npm、Chrome 下载基本就都正常了。

## 13. 安装 Chrome

可以直接运行：

```powershell
winget install --id Google.Chrome --source winget
```

如果出现：

```text
0x80072ee2
InternetOpenUrl() failed
```

通常不是 Chrome 的问题，而是网络或代理没有走通。

如果终端命令也需要代理，可以在当前 PowerShell 里设置：

```powershell
$env:HTTP_PROXY="http://10.0.2.2:7897"
$env:HTTPS_PROXY="http://10.0.2.2:7897"
```

然后重新执行安装。

## 14. 安装 Git

进入：

```text
https://git-scm.com/install/windows
```

下载 x64 Setup，安装基本一路默认。

验证：

```powershell
git --version
```

正常输出版本号即可。

## 15. 安装 Node.js + npm

Node.js 建议选择：

```text
Windows
x64
LTS
Windows Installer (.msi)
```

不要选择 Docker 那一套。

安装完成以后验证：

```powershell
node -v
npm -v
```

两个都返回版本号说明成功。

Node 后面非常重要，因为 OpenCode、Playwright CLI 和很多 Agent 工具都需要 Node/npm。

## 16. 安装 OpenCode

OpenCode 是这套工作流里很重要的一环。

我的分工思路是：

```text
贵模型
→ 理解问题
→ 设计流程
→ 解决复杂异常

便宜模型
→ Playwright
→ 打开网页
→ 点击
→ 翻页
→ 提取数据
→ CSV
→ URL 检查
```

安装：

```powershell
npm install -g opencode-ai
```

检查：

```powershell
opencode --version
```

启动：

```powershell
opencode
```

如果 npm 长时间只有旋转符号，可以先 `Ctrl + C`，然后检查：

```powershell
npm ping
```

如果 npm 本身没有走代理，可以单独配置：

```powershell
npm config set proxy http://10.0.2.2:7897
npm config set https-proxy http://10.0.2.2:7897
```

再执行：

```powershell
npm ping
```

成功后重新安装。

## 17. 安装 Playwright CLI

Playwright CLI 是后面浏览器自动化真正的执行工具。

安装：

```powershell
npm install -g @playwright/cli@latest
```

检查：

```powershell
playwright-cli --help
```

安装 Coding Agent skills：

```powershell
playwright-cli install --skills
```

最小测试：

```powershell
playwright-cli open https://example.com
```

如果浏览器成功打开 Example Domain，就说明 Playwright CLI 已经能工作。

结束：

```powershell
playwright-cli close
```

后面真正的自动化大概就是：

```text
打开网页
↓
搜索
↓
点击详情
↓
找到官网
↓
提取数据
↓
保存 CSV
```

## 18. 安装 AITDK

AITDK 是 Chrome 扩展，后面研究竞品时重点看：

- 月访问量
- Traffic Sources
- Top Keywords
- Top Regions
- 域名注册时间
- Title / Description

Chrome 打开：

```text
https://aitdk.com/extension
```

安装扩展即可。

真正做竞品研究时，AITDK 左边几十个菜单不用全看。

重点看：

```text
Traffic
Whois
Overview
```

尤其是：

```text
Monthly Visits
Top Keywords
Traffic Sources
Top Regions
Domain Registration Date
```

## 19. 安装 Claude Code

Windows PowerShell 执行：

```powershell
irm https://claude.ai/install.ps1 | iex
```

第一次安装直接失败：

```text
Failed to fetch version
ECONNREFUSED xx.xx.xx.xx:443
```

原因仍然是安装器没有正确走代理。

于是先设置当前 PowerShell 的代理环境变量：

```powershell
$env:HTTP_PROXY="http://10.0.2.2:7897"
$env:HTTPS_PROXY="http://10.0.2.2:7897"
```

再测试：

```powershell
curl.exe -I https://downloads.claude.ai/claude-code-releases/latest
```

确认网络可以访问以后重新执行：

```powershell
irm https://claude.ai/install.ps1 | iex
```

最终成功后会看到类似：

```text
Claude Code successfully installed!

Version: 2.1.233
Location:
C:\Users\raoji\.local\bin\claude.exe
```

## 20. Claude 安装成功却输入 claude 没反应

安装器其实已经提示：

```text
C:\Users\raoji\.local\bin
is not in your PATH
```

所以并不是 Claude 没装成功，而是 Windows 不知道 `claude.exe` 在哪里。

先验证：

```powershell
& "C:\Users\raoji\.local\bin\claude.exe" --version
```

如果正常，就把这个目录加入用户 Path：

```text
C:\Users\raoji\.local\bin
```

路径：

```text
系统属性
→ 高级
→ 环境变量
→ 用户变量
→ Path
→ New
```

重新打开 PowerShell：

```powershell
claude --version
```

即可。

## 21. 安装 Hermes

Hermes 是最后一个，也是整套系统里最有意思的部分。

它的定位不是代替 OpenCode 或 Claude Code，而是远程任务分发入口。

例如：

```text
手机微信
↓
Hermes
↓
Claude Code / OpenCode
↓
电脑执行
↓
Hermes
↓
微信收到结果
```

也就是从微信发任务，让 Hermes 调用 OpenCode 或 Claude Code，在测试目录创建文件，再把执行结果回复到微信。

Windows PowerShell 先设置代理：

```powershell
$env:HTTP_PROXY="http://10.0.2.2:7897"
$env:HTTPS_PROXY="http://10.0.2.2:7897"
```

然后执行 Hermes 安装程序。

安装过程中一度跳转到了 Nous Portal 的订阅授权页面。但这次任务并不要求购买 Nous 模型套餐。

我的选择是：

```text
Hermes Provider：
OpenAI Codex

认证：
ChatGPT OAuth

不使用：
OpenAI API Key
```

## 22. Hermes 接入 ChatGPT / Codex OAuth

成功导入凭据后，终端显示：

```text
Credentials imported.

Config updated:
model.provider=openai-codex
```

然后 Hermes 会让选择默认模型：

```text
1. gpt-5.6-sol
2. gpt-5.6-terra
3. gpt-5.6-luna
4. gpt-5.5
5. gpt-5.4
...
```

最后选择：

```text
4
```

得到：

```text
Default model set to:
gpt-5.5
(via OpenAI Codex)
```

这意味着链路已经打通：

```text
Hermes
↓
OpenAI Codex Provider
↓
ChatGPT OAuth
↓
GPT 模型
```

## 23. Hermes 微信配置

微信配置过程中会询问：

```text
How should direct messages be authorized?
```

选项：

```text
1. Use DM pairing approval (recommended)
2. Allow all direct messages
3. Only allow listed user IDs
4. Disable direct messages
```

我选择：

```text
1
```

也就是 DM pairing approval。

第一次连接需要人工批准，更安全。

后面流程就是：

```text
Weixin
↓
扫码
↓
Hermes Gateway
↓
DM Pairing
↓
微信发消息
↓
Hermes 回复
```

真正有批量任务时，再让 Hermes 调用 Coding Agent。

## 24. 环境完成以后，真正的任务才开始

这里很容易产生一个误解：

> 装完这么多东西，是不是马上就应该让 Agent 自动抓网站？

恰恰相反。

第一阶段应该先人工研究，比如先看 10 个 AI 视频产品。

可以从这些网站开始：

- Toolify
- Product Hunt
- SaaSHub
- AlternativeTo

而且先别急着让 Agent 抓。

## 25. 每个产品应该研究什么

每看到一个产品，先回答：

```text
产品：
网址：

给谁用：
输入：
AI 做什么：
输出：
价格：

它解决什么问题：
为什么值得继续看：
```

其中“输入”不是价格，而是用户把什么东西交给 AI。

比如：

- 文字 Prompt
- 图片
- 视频
- 网址
- 音频
- PDF
- 商品照片

“输出”则是用户最后获得什么。

比如：

- 视频
- 图片
- 数字人口播
- 剪辑好的短视频
- 声音
- 字幕

最终要形成的是：

> 谁 → 输入什么 → AI 做什么 → 得到什么 → 为什么愿意付钱

## 26. AITDK 到底看什么

找到一个有意思的产品后，再用 AITDK。

重点看：

- 月访问量
- Top Keywords
- Traffic Sources
- Top Regions
- 域名注册时间

尤其是 Top Keywords。

这里需要区分：

```text
Density
≠
Top Keywords
```

Density 是网页本身反复出现哪些词。

Top Keywords 更重要，因为它代表用户主要通过搜索哪些关键词找到这个网站。

比如：

```text
ai video generator
image to video ai
product video maker
```

这种关键词可以直接反推用户正在主动搜索什么需求。

## 27. 这套环境真正教会了我什么

真正重要的不是记住哪一条安装命令。

因为这些工具以后都会变。

真正值得保留下来的工作方式是：

```text
自己先做
↓
理解正确答案
↓
找到重复劳动
↓
选择合适成本的 Agent
↓
让 Agent 自动化
↓
检查 Agent 输出
↓
正确以后再放大
```

AI Agent 真正有价值的地方，不是：

> 我把任务丢给 AI，然后什么都不管。

而是：

> 我先理解业务，然后设计流程，再让不同能力、不同成本的 AI 替我完成重复劳动。

最终，人负责判断。

AI 负责放大。
