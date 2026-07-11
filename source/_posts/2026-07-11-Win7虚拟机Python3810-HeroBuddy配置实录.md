---
title: 从 ISO 到可用：Win7 虚拟机安装 Python 3.8.10 
date: 2026-07-11 22:00:00
tags:
  - 工作总结
  - Windows 7
  - Python
  - VirtualBox
categories:
  - 工作记录
---

# 从 ISO 到可用：Win7 虚拟机安装 Python 3.8.10 

这篇记录的是一次很真实的老系统配置过程：从下载 Windows 7 ISO、创建虚拟机、安装一堆系统补丁，到最后装上 Python 3.8.10，验证在win7 python 3.8.10限定环境下开发的的一个agent，他叫做herobuddy,意寓着是为你冲锋陷阵的伙伴，形象暂定可爱小狗吧（毕竟小狗是人类忠实的伙伴），但是很可惜，用代码还画不出来（啥时候codex能加强一下审美）

这不是那种“复制三行命令就成功”的教程。Windows 7 已经很老了，麻烦不在某一个工具，而是在一整条链路：ISO、虚拟机、Guest Additions、共享文件夹、系统补丁、Python 版本、证书、API 兼容格式、环境变量、命令行编码、启动脚本。任何一个地方没处理好，最后表现出来都可能只是“没反应”“安装失败”“一大堆报错”。



## 一、这次最终环境

先把最终状态写清楚，后面所有步骤都是为了达到这个状态。

```text
虚拟机软件：VirtualBox
虚拟机系统：Windows 7
Python 版本：3.8.10
项目目录：C:\Users\hero\HeroBuddy
命令入口：C:\Users\hero\bin\herobuddy.cmd
共享文件夹：\\VBOXSVR\hbshare
API 服务：火山方舟 Coding Plan
模型：glm-5.2
```

最终在 Win7 里验证过这些能力：

```bat
python --version
herobuddy doctor
herobuddy "Reply with OK only."
herobuddy
```

真实 API 请求可以返回 `OK`，说明 Python、证书、网络、API Key、方舟接口、HeroBuddy 启动器都已经串起来了。

## 二、为什么不是直接在本机跑

如果只是想跑一个 Python AI 工具，在现代 Windows、macOS 或 Linux 上当然简单得多。但这次目标是 Windows 7，因为老系统兼容性本身就是问题的一部分。

类似需求其实并不少见：

1. 某些旧软件只能在 Win7 上跑。
2. 想验证 Python 工具在老系统上的最低可用环境。
3. 想把实验环境隔离在虚拟机里。
4. 想知道现代 AI Coding 工具能不能下沉到旧 Windows。

结论是：能跑，但不能跳步骤。Win7 最大的问题不是“跑不了”，而是每一层都要处理得更保守。

## 三、下载 Windows 7 ISO

第一步是准备 Windows 7 ISO。

这里建议尽量使用干净的 Windows 7 SP1 镜像，不要随便找精简版、Ghost 版或装机版。精简系统可能删掉一些后面安装 Python、运行库、补丁会用到的组件，到时候报错会很难判断。

下载时需要提前想清楚架构：

```text
32 位 Win7：后面补丁和 Python 安装包都选 x86
64 位 Win7：后面补丁和 Python 安装包都选 x64 / amd64
```

如果你只是为了跑 Python 3.8.10，32 位系统也不是完全不行，但后面所有东西都要跟着选 x86。最怕的是系统是 32 位，补丁下了 x64，安装时就会提示“不适用于此计算机”。

## 四、创建 VirtualBox 虚拟机

VirtualBox 新建虚拟机时，我建议按保守配置来：

```text
类型：Microsoft Windows
版本：Windows 7
内存：2GB 起步，4GB 更舒服
硬盘：40GB 起步，动态分配即可
网络：NAT
光驱：挂载 Windows 7 ISO
```

安装系统过程按向导走即可。用户名可以随便取，这次虚拟机里用的是：

```text
hero
```

所以后面路径会出现：

```bat
C:\Users\hero
```

如果你的用户名不是 `hero`，把路径换成自己的用户名就行。

系统装完后，建议立刻做一个快照。后面补丁和运行库会反复装，万一搞乱了，回滚比重装快得多。

## 五、安装 Guest Additions

刚装好的 Win7 虚拟机体验会比较原始：分辨率不舒服、鼠标切换麻烦、剪切板不通、文件传输也麻烦。所以先装 VirtualBox Guest Additions。

在 VirtualBox 菜单里选择：

```text
Devices -> Insert Guest Additions CD image
```

Win7 里打开光驱，运行：

```text
VBoxWindowsAdditions.exe
```

安装完成后重启虚拟机。

重启后建议开启：

```text
Shared Clipboard: Bidirectional
```

也就是双向剪切板。后面会频繁复制命令，这一步很省时间。

## 六、配置共享文件夹

这一步非常关键。

一开始如果直接在 Win7 里下载 Python、补丁、项目文件，很容易被浏览器和证书问题卡住。Win7 的浏览器、TLS 支持和系统证书都太旧，很多现代网站会打不开或下载失败。

更稳的流程是：

1. 宿主机浏览器下载 ISO、补丁、Python 安装包、项目文件。
2. 放进宿主机某个下载目录。
3. VirtualBox 把这个目录共享给 Win7。
4. Win7 通过共享路径读取。

这次共享名用了英文：

```text
hbshare
```

Win7 里访问路径是：

```bat
\\VBOXSVR\hbshare
```

为什么建议共享名用英文？因为中文用户名、中文路径、老 Windows 命令行编码混在一起时，很容易出现奇怪问题。共享名用英文，可以少踩一个坑。

## 七、确认 Win7 是 x86 还是 x64

进入 Win7 后，先不要急着装 Python。打开 `cmd`，运行：

```bat
wmic os get osarchitecture
```

如果输出是：

```text
OSArchitecture
64-bit
```

后面就下载 x64 / amd64。

如果输出是：

```text
OSArchitecture
32-bit
```

后面就下载 x86。

这个检查一定要做。不要靠“我觉得应该是 64 位”来判断。

## 八、为什么选择 Python 3.8.10

Win7 不能直接装最新 Python。

Python 3.11、3.12 这些版本已经不再把 Win7 当目标环境。即使安装包能下载下来，也很可能直接跑不起来。

这次选择的是：

```text
Python 3.8.10
```

对应安装包大概是：

```text
python-3.8.10.exe
python-3.8.10-amd64.exe
```

32 位 Win7 选 x86，64 位 Win7 选 amd64。

Python 3.8.10 是一个比较现实的平衡点：它足够新，能跑很多现代 Python 项目；同时又没有新到完全抛弃 Win7。

## 九、最耗时间的一关：系统补丁

这次最折腾是 Python 安装前的系统补丁

典型过程是这样的：

```text
运行 Python 3.8.10 安装器
-> 安装器提示缺少某个系统更新
-> 回宿主机下载对应补丁
-> 放进共享文件夹
-> Win7 复制到本地
-> 安装补丁
-> 重启
-> 再运行 Python 安装器
```

这一步可能会循环好几次。装一个补丁不一定就够，因为老 Win7 镜像可能缺一串前置更新。

有一个非常重要的小细节：

```text
补丁安装完要重启。
```

我们中间就遇到过“下载了、安装了，但忘记重启”的情况。结果继续装 Python，还是报错。老系统很多更新不重启不会真正生效。

## 十、常见补丁方向

不同 Win7 镜像缺的补丁不完全一样，所以不要把下面列表理解成“每个人必须按顺序全装”。更合理的方式是：

```text
Python 安装器报什么，就优先补什么。
```

但 Win7 + Python 3.8.10 场景里，常见排查方向包括：

```text
Windows 7 Service Pack 1
KB2533623
KB2999226 / Universal C Runtime
Visual C++ Redistributable
SHA-2 签名支持相关更新，例如 KB4474419
Windows Update Client 相关更新，例如 KB3138612
```

其中 `KB2533623` 是很常见的坑。我们当时也遇到过“这个补丁不好找”的情况。

找补丁时建议这样搜：

```text
KB2533623 Windows 7 x86
KB2533623 Windows 7 x64
```

按自己的系统架构下载。不要 x86 和 x64 混着来。

如果补丁安装时提示“不适用于你的计算机”，常见原因有：

1. 架构选错。
2. 系统不是 SP1。
3. 这个补丁已经装过。
4. 缺少另一个前置补丁。
5. 下载成了 Server 或其他 Windows 版本的包。

## 十一、补丁下载后怎么弄进虚拟机

最稳的是共享文件夹。

宿主机下载补丁后，放进共享目录。Win7 里打开：

```bat
\\VBOXSVR\hbshare
```

把 `.msu` 或 `.exe` 文件复制到 Win7 桌面或 Downloads，再双击安装。

理论上也可以直接从共享目录运行安装包，但老系统里权限、路径、中文名都有可能增加不确定性。我更建议先复制到虚拟机本地，再运行安装。

## 十二、安装 Python 3.8.10

补丁装完并重启后，再运行 Python 3.8.10 安装包。

安装时建议勾选：

```text
Add Python 3.8 to PATH
```

但不要完全依赖 PATH。Win7 的 PATH 有时并不可靠，所以后面启动脚本里仍然使用了 Python 的绝对路径：

```bat
%LOCALAPPDATA%\Programs\Python\Python38\python.exe
```

安装完成后，新开一个 `cmd`，检查：

```bat
python --version
```

如果 PATH 没生效，就用绝对路径：

```bat
"%LOCALAPPDATA%\Programs\Python\Python38\python.exe" --version
```

目标输出：

```text
Python 3.8.10
```

这一步通过之后，才说明 Python 这一层真的铺好了。

## 十三、把 HeroBuddy 项目复制进 Win7

项目最终放在：

```bat
C:\Users\hero\HeroBuddy
```

如果自己复现，可以这样做：

1. 宿主机把项目放进共享目录。
2. Win7 打开 `\\VBOXSVR\hbshare`。
3. 复制到 `C:\Users\你的用户名\HeroBuddy`。

项目大概结构是：

```text
HeroBuddy
├─ herobuddy
├─ scripts
├─ tests
├─ herobuddy.ark.json
└─ herobuddy.cmd
```

这里的 `herobuddy.ark.json` 是 API 配置，`herobuddy.cmd` 是命令行入口。

## 十四、API Key 不要写进配置文件

一开始最容易想到的是把 API Key 直接写进 JSON 文件：

```json
{
  "api_key": "你的 key"
}
```

这样确实简单，但不推荐。

原因很实际：

1. 配置文件可能被提交到 Git。
2. 可能被复制给别人。
3. 可能出现在截图或博客里。
4. Key 泄露后会产生真实费用风险。

所以最终采用环境变量：

```json
{
  "api_key_env": "ARK_API_KEY"
}
```

Win7 里设置：

```bat
setx ARK_API_KEY "你的火山方舟 API Key"
```

注意，`setx` 设置的是之后新开的命令行窗口。执行完后，要关闭当前 `cmd`，重新打开一个新的 `cmd`。

检查时可以运行：

```bat
echo %ARK_API_KEY%
```

确认能读到即可。写博客或截图时不要展示真实 Key。

## 十五、火山方舟 Coding Plan 的正确接口

这次 API 接入最大的坑是：一开始按 OpenAI Chat Completions 的格式去配，方向是错的。

很多 OpenAI 兼容服务会让人想到：

```text
/api/v3/chat/completions
```

但火山方舟 Coding Plan 文档给的是 Anthropic/Claude 兼容接口。

最终正确配置是：

```json
{
  "provider": "anthropic-messages",
  "model": "glm-5.2",
  "base_url": "https://ark.cn-beijing.volces.com/api/coding",
  "api_key_env": "ARK_API_KEY",
  "permission_mode": "default",
  "max_turns": 8,
  "timeout_seconds": 60
}
```

关键点有三个：

```text
provider 不是 openai，而是 anthropic-messages
base_url 是 https://ark.cn-beijing.volces.com/api/coding
model 用 Coding Plan 里的模型名 glm-5.2
```

如果这一步配错，代码本身可能没问题，但 API 会一直报错。

## 十六、Win7 的 HTTPS 证书问题

API 配好之后，又遇到 HTTPS 证书问题。

Win7 系统证书太旧，Python 请求现代 HTTPS 服务时，可能会证书校验失败。不要为了省事直接关闭 SSL 校验。正确做法是给 Python 指定可用的 CA bundle。

这次使用的是 Python 环境里 pip vendored certifi 的证书文件：

```json
{
  "ca_bundle": "%LOCALAPPDATA%\\Programs\\Python\\Python38\\lib\\site-packages\\pip\\_vendor\\certifi\\cacert.pem"
}
```

同时代码里要展开环境变量。也就是说，程序不能把 `%LOCALAPPDATA%` 当普通字符串，而要先变成类似：

```bat
C:\Users\hero\AppData\Local\Programs\Python\Python38\lib\site-packages\pip\_vendor\certifi\cacert.pem
```

这样做的好处是：

1. 保留 HTTPS 校验。
2. 不依赖 Win7 过时的系统证书。
3. 不把安全问题留给以后。

## 十七、让 `herobuddy` 变成真正的命令

只靠下面这种命令当然也能跑：

```bat
python -m herobuddy --config herobuddy.ark.json chat
```

但这太长了，不适合日常使用。所以写了一个 `herobuddy.cmd` 启动器。

这个启动器做几件事：

1. 找到 HeroBuddy 项目目录。
2. 找到 Python 3.8.10 的绝对路径。
3. 默认加载 `herobuddy.ark.json`。
4. 无参数时进入聊天模式。
5. 有普通参数时自动转成一次性提问。
6. `ask`、`chat`、`doctor` 子命令原样转发。

最终体验是：

```bat
herobuddy
```

进入聊天。

```bat
herobuddy "hello"
```

一次性提问。

```bat
herobuddy doctor
```

检查配置。

这里还有一个真实踩过的小坑：

```bat
herobuddy"hello"
```

这是错的。命令和参数中间必须有空格：

```bat
herobuddy "hello"
```

否则 Windows 会把 `herobuddy"hello"` 当成一个完整命令名。

## 十八、把启动器放进 PATH

为了让任何目录下都能输入 `herobuddy`，启动器放到了：

```bat
C:\Users\hero\bin\herobuddy.cmd
```

然后让新的 `cmd` 能找到这个目录。

配置完成后，新开一个 `cmd`，运行：

```bat
where herobuddy
```

应该能看到：

```bat
C:\Users\hero\bin\herobuddy.cmd
```

这样就不用每次进入项目目录，也不用输入完整 Python 命令。

## 十九、加上交互模式

最开始只是想让这个命令能一次性提问：

```bat
herobuddy "hello"
```

后来继续做成了交互模式：

```bat
herobuddy
```

里面支持这些命令：

```text
/help
/status
/clear
/doctor
/exit
```

含义是：

```text
/help    查看帮助
/status  查看 provider、model、workspace 和上下文数量
/clear   清空当前对话
/doctor  运行配置检查
/exit    退出
```

这一步不是 Win7 必需，但对体验很关键。不然每问一句都要重新敲一遍命令。

## 二十、处理 Win7 控制台编码

Win7 中文系统里的 `cmd` 常见编码是 GBK。现代模型回复里可能带 emoji、特殊符号、罕见 Unicode 字符。直接输出时，可能触发编码错误。

这次处理方式是：输出文本时捕获 `UnicodeEncodeError`。如果当前控制台编码不支持某些字符，就用替换字符输出，而不是让程序崩掉。

最终效果是：

```text
中文正常显示
英文正常显示
特殊符号最坏显示成 ?
程序不会因为一个 emoji 直接退出
```

老 Windows 命令行工具一定要做这种兜底。

## 二十一、本机兼容性检查

因为目标环境是 Python 3.8.10，所以不能只在宿主机的新 Python 上觉得“能跑就行”。

本机跑了兼容检查：

```bat
python scripts\check_compat.py
```

这个检查主要关注两类问题：

1. 单元测试是否通过。
2. 代码有没有用了 Python 3.8 不支持的新语法。

比如这些东西不能随便用：

```text
match/case
list[str]
dict[str, str]
tomllib
TaskGroup
ExceptionGroup
```

否则宿主机可能能跑，Win7 的 Python 3.8.10 直接失败。

## 二十二、Win7 里的最终验证

先确认 Python：

```bat
"%LOCALAPPDATA%\Programs\Python\Python38\python.exe" --version
```

期望输出：

```text
Python 3.8.10
```

再检查 HeroBuddy 配置：

```bat
herobuddy doctor
```

应该能看到类似：

```text
Provider anthropic-messages
Model glm-5.2
OK
```

然后做一次真实 API 请求：

```bat
herobuddy "Reply with OK only."
```

返回：

```text
OK
```

最后测试交互模式：

```bat
herobuddy
```

进入后输入：

```text
/status
/exit
```

能正常响应并退出，说明命令入口、配置读取、交互循环都没问题。

## 二十三、这次踩过的坑

### 1. Python 安装器一直失败

症状：Python 3.8.10 安装器启动后提示缺少系统组件或补丁。  
原因：Win7 镜像缺必要系统更新。  
解决：按安装器提示的 KB 编号下载对应架构补丁，安装后重启，再继续安装 Python。

### 2. x86 / x64 下错

症状：补丁提示“不适用于你的计算机”。  
原因：系统架构和补丁架构不一致，或者缺少前置条件。  
解决：先运行 `wmic os get osarchitecture`，确认架构后再下载。

### 3. 补丁装完忘记重启

症状：明明装了补丁，Python 安装器还是报错。  
原因：补丁没有重启生效。  
解决：补丁安装完成后立刻重启。

### 4. KB2533623 不好找

症状：安装器点名某个 KB，但官方下载入口不好找。  
原因：老补丁页面可能迁移，搜索结果也很混乱。  
解决：用 `KB 编号 + Windows 7 + x86/x64` 搜索，并确认下载的是 Win7 对应架构包。

### 5. Win7 里直接下载东西很痛苦

症状：网页打不开、下载失败、证书报错。  
原因：Win7 浏览器和 TLS/证书太旧。  
解决：宿主机下载，虚拟机通过共享文件夹读取。

### 6. API 按 OpenAI 格式配错

症状：程序能运行，但 API 请求失败。  
原因：方舟 Coding Plan 走 Anthropic/Claude 兼容接口。  
解决：provider 改为 `anthropic-messages`，base URL 改为 `/api/coding`。

### 7. HTTPS 证书失败

症状：Win7 Python 请求 API 时 SSL 报错。  
原因：系统证书过旧。  
解决：配置 `ca_bundle` 指向 Python 环境里的 certifi 证书文件。

### 8. 设置了 API Key 但程序读不到

症状：刚执行 `setx ARK_API_KEY` 后，程序仍提示 API Key missing。  
原因：旧的 `cmd` 窗口不会自动读取新环境变量。  
解决：关闭当前窗口，重新打开一个新的 `cmd`。

### 9. `herobuddy"hello"` 没反应

症状：输入后没有得到预期回复。  
原因：命令和参数之间没有空格。  
解决：写成 `herobuddy "hello"`。

### 10. 模型回复特殊字符导致控制台报错

症状：模型返回 emoji 或特殊 Unicode 字符时，Win7 控制台崩掉。  
原因：GBK 控制台无法编码所有 Unicode 字符。  
解决：输出函数捕获编码异常，无法显示的字符用替换方式输出。

## 二十四、如果重新来一次，我会按这个顺序

```text
1. 下载可信 Windows 7 SP1 ISO
2. 创建 VirtualBox 虚拟机
3. 安装 Win7
4. 安装 Guest Additions
5. 开启双向剪切板
6. 配置英文名共享文件夹
7. 确认 Win7 是 x86 还是 x64
8. 下载 Python 3.8.10 对应架构安装包
9. 运行 Python 安装器，看缺什么补丁
10. 宿主机下载补丁
11. 通过共享文件夹传进 Win7
12. 安装补丁并重启
13. 重试 Python 安装
14. 验证 Python 3.8.10
15. 复制 HeroBuddy 项目
16. 设置 ARK_API_KEY 环境变量
17. 写 herobuddy.ark.json
18. 配置 ca_bundle
19. 安装 herobuddy.cmd
20. 新开 cmd，运行 where herobuddy
21. 运行 herobuddy doctor
22. 运行真实 API 请求
23. 进入 herobuddy 交互模式
```

这个顺序的重点是：先系统，再 Python，再项目，再 API。不要跳着做。

## 二十五、最小复现检查清单

最后至少通过这些命令：

```bat
wmic os get osarchitecture
"%LOCALAPPDATA%\Programs\Python\Python38\python.exe" --version
where herobuddy
herobuddy doctor
herobuddy "Reply with OK only."
herobuddy
```

进入交互模式后，再输入：

```text
/status
/exit
```

这些都通过，说明：

1. Win7 架构没搞错。
2. Python 3.8.10 可用。
3. HeroBuddy 命令入口可用。
4. API Key 可读取。
5. 方舟 Coding Plan 可访问。
6. HTTPS 证书问题已解决。
7. 交互模式可用。

## 二十六、安全提醒

Win7 已经过了主流支持周期，不建议把它当日常联网主力系统。

它更适合：

1. 兼容性测试。
2. 旧软件验证。
3. 隔离环境实验。
4. 明确知道风险的开发验证。

API Key 也不要写进仓库、截图、博客或共享文件夹里。用环境变量是更稳的做法。

## 结语

这次配置最大的感受是：在老系统上跑现代 AI 工具，难点不在模型，而在系统工程。

ISO、VirtualBox、Guest Additions、共享目录、系统补丁、Python 3.8.10、HTTPS 证书、方舟 Coding Plan 的接口格式、命令行入口、Win7 控制台编码，每个点单独看都不复杂，但任何一个没处理好，最终用户看到的都可能只是“没反应”或“一堆报错”。

最后跑通以后，体验反而很简单：打开 Win7 的 `cmd`，输入：

```bat
herobuddy
```

就能进入一个接了火山方舟 `glm-5.2` 的本地 AI Coding 助手。

这篇算作一个记录吧，希望自己以后还能翻翻看看在这个时间段做了点啥事（好像胡适啊哈哈哈，“先前定下的学习计划，你都忘了吗”，实在是不想再踩坑了，基本每一步都会报错，环境这个还是太难整了，第一次弄虚拟机。HAPPY Ending!