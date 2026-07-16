---
title: KIE Gemini API 接入踩坑复盘：OpenAI-compatible 不等于完全兼容
date: 2026-07-16 18:30:00
tags:
  - KIE
  - Gemini
  - API接入
  - 工程复盘
categories:
  - 工作记录
---

在尝试接入 KIE 的 Gemini API。原本以为它提供了 OpenAI-compatible 的调用方式，应该可以比较顺利地接进现有项目，但实际开发过程中连续遇到了好几类报错，特此记录一下这debug的路程（遇到的问题、原因和修复思路）

## 上传图片时拿不到 fileUrl

最开始遇到的错误是：

```text
KIE 图片上传响应缺少 fileUrl
```

当时的流程是：前端把图片转成 base64，服务端先调用 KIE 的文件上传接口，然后把返回的图片 URL 传给 Gemini 视觉模型。

我一开始假设上传接口会返回类似这样的结构：

```ts
data.data.fileUrl
```

于是代码里直接写死读取 `data.data.fileUrl`。

但实际调用后发现，KIE 的返回结构并不一定是这个字段。它可能返回 `url`、`file_url`，也可能把 URL 放在更深层的对象里。

这个问题的本质是：我过早相信了文档示例里的理想结构，没有先用最小脚本确认真实响应。

后来的修复方式是，不再写死某一个字段，而是递归扫描响应对象，找到第一个 `http` 或 `https` 开头的 URL：

```ts
function findFirstHttpUrl(value: unknown): string | null {
  if (typeof value === "string") {
    return /^https?:\/\//i.test(value) ? value : null;
  }

  if (!value || typeof value !== "object") return null;

  for (const item of Object.values(value as Record<string, unknown>)) {
    const found = findFirstHttpUrl(item);
    if (found) return found;
  }

  return null;
}
```

这样即使 KIE 的字段名有变化，也能更稳地拿到图片地址。

## Gemini 响应里找不到 JSON 文本

图片上传问题修完后，又出现了新的错误：

```text
KIE Gemini 响应没有包含 JSON 文本
```

我当时是按 OpenAI Chat Completions 的格式来解析响应的，默认读取：

```ts
choices[0].message.content
```

但实际响应并不总是这个结构。有时内容可能在：

```ts
choices[0].text
```

也可能是：

```ts
output_text
```

还有可能 `message.content` 不是字符串，而是数组或更复杂的对象。

所以这里的问题不是模型没返回内容，而是我的解析逻辑太死板。

后来我把解析逻辑改成从多个位置尝试提取文本：

```ts
const candidates = [
  data.output_text,
  data.choices?.[0]?.message?.content,
  data.choices?.[0]?.message?.reasoning_content,
  data.choices?.[0]?.text,
  data.choices?.[0]?.delta?.content
];
```

同时对数组和对象做递归拼接，尽量把可能的文本内容都提取出来。

这次问题说明，所谓 OpenAI-compatible 只能说明接口大体形式相似，不代表返回结构完全一致。

## response_format 不兼容

接下来遇到的错误更典型：

```text
$.response_format.json_schema.schema.properties.decorLayer.items.properties.type must be string or array
```

当时我希望 KIE Gemini 直接返回严格符合项目 schema 的 JSON，于是传了 `response_format.json_schema`。

这个写法在 OpenAI 里比较常见，但 KIE 对这部分的兼容并不完全一致。

项目里的 schema 大概长这样：

```ts
decorLayer: {
  type: "array",
  items: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["icon", "logo", "photo", "decoration"]
      }
    }
  }
}
```

这里既有 JSON Schema 自己的 `type`，业务字段里也有一个叫 `type` 的属性。KIE 的校验器在处理这种结构时直接报错。

这个问题让我意识到：不能因为接口叫 OpenAI-compatible，就默认它支持所有 OpenAI 的结构化输出能力。

最后的处理方式是取消 `response_format`，改成在 prompt 里要求模型“只返回 JSON”，然后服务端本地再用 Zod 校验。

## 模型返回 JSON，但不符合 schema

取消 `response_format` 后，模型终于能返回 JSON 了，但很快又遇到一组新的 Zod 校验错误：

```text
canvas.width 缺失
canvas.height 缺失
backgroundLayer 应该是 object，但收到 array
decorLayer.source 缺失
editableLevel 枚举值非法
```

这说明模型虽然返回了 JSON，但它并不会稳定遵守我们定义的数据结构。

常见问题包括：

- 忘记返回 `canvas.width` 和 `canvas.height`
- 把对象写成数组
- 坐标字段命名不一致
- 缺少必填字段
- 枚举值不符合要求

一开始我直接把模型输出交给 Zod：

```ts
LayeredSlideSchema.parse(modelOutput)
```

这就导致模型稍微偏一点，整个流程就失败。

后来加了一层 normalize：

```text
模型原始 JSON
  ↓
补默认字段
  ↓
修正字段类型
  ↓
统一坐标字段
  ↓
过滤非法值
  ↓
再交给 Zod 校验
```

例如：

- 缺 `canvas.width/height` 时，用输入图片尺寸补上
- `backgroundLayer` 如果是数组，就取第一个对象
- `x/y/w/h` 缺失时给默认值
- 非法枚举值改成默认值
- 缺失数组补成空数组

这样模型输出即使不完全规范，也不会马上导致整个流程中断。

## 这次接入暴露的问题

这次 KIE API 一直接连报错，表面上看是字段解析、schema 校验、响应格式的问题，但本质上有几个教训。

第一，不能过度相信兼容接口。

KIE 虽然提供了类似 OpenAI 的调用方式，但上传响应、chat 响应、结构化输出支持都和 OpenAI 不完全一致。以后接这类 API，要先跑最小探测脚本，看真实响应长什么样。

第二，不能直接相信模型 JSON。

模型返回 JSON 不代表它符合业务 schema。尤其是视觉模型，输出经常会漏字段、改字段名、写错枚举。正确做法应该是：

```text
宽松解析
  ↓
normalize
  ↓
schema validate
  ↓
业务使用
```

第三，错误信息要带响应摘要。

一开始错误只写“缺少 fileUrl”或“没有 JSON 文本”，调试效率很低。后来把截断后的响应摘要也放进错误信息，才能快速知道 KIE 实际返回了什么。

第四，第三方 API provider 要单独做兼容层。

不能把 KIE 当成 OpenAI 的简单换皮版本。每个 provider 都应该有自己的：

- 请求构造
- 响应解析
- 错误处理
- 输出 normalize
- fallback 逻辑

## 总结

KIE Gemini 接入时连续报错，主要原因不是某一行代码写错，而是我一开始对它的兼容性估计过高。

这次踩坑后，我对第三方模型 API 的接入方式有了更清晰的判断：

- 文档示例只能作为参考，真实响应必须自己验证；
- OpenAI-compatible 不等于完全兼容；
- 结构化输出不能假设稳定；
- 模型输出必须经过 normalize；
- provider 层要有足够强的容错和诊断能力。

后续如果继续接入类似的模型服务，应该先写一个最小验证脚本，把上传、推理、错误响应、结构化输出都跑一遍，再正式接入业务代码。
