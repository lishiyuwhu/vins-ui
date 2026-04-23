# Image Upload URL

本文档整理了图片上传接口接入方式，聚焦 `Image Upload URL` 本身，供当前工程内部存档使用。

---

## 环境变量

| 变量名 | 说明 | 示例值 |
|---|---|---|
| `IMAGE_UPLOAD_API_URL` | 图片上传服务完整 URL | `http://v-dev-gpu4-11168979-ccc-wl0102-vtraining.vmic.xyz/api/v1/upload-image-base64` |

---

## 接口概览

| 项 | 内容 |
|---|---|
| 前端调用路径 | `POST /api/upload-image-base64` |
| 真实目标 | `POST {IMAGE_UPLOAD_API_URL}` |
| 用途 | 上传 Base64 图片，获取图片 URL |

---

## 接口说明

前端会先将本地图片文件读取为 Data URL，格式如下：

```text
data:<mime>;base64,<data>
```

随后将其发送到上传服务，换取一个可公开访问的图片 URL。该 URL 会被后续图片推荐和图片编辑任务接口继续使用。

---

## Request Headers

```http
Content-Type: application/json
```

## Request Body

```json
{
  "image_base64": "data:image/jpeg;base64,/9j/4AAQ..."
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `image_base64` | string | 是 | 图片的完整 Data URL，包含 MIME 前缀 |

---

## Response Body

成功响应示例：

```json
{
  "img_url": "https://cdn.example.com/uploads/abc123.jpg"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `img_url` | string | 图片的可访问 URL，用于后续接口传参 |

---

## 错误处理

- 响应非 2xx：前端抛出 `Image upload failed: HTTP <status>`
- `img_url` 为空：前端抛出 `Image upload returned no img_url.`

---

## 相关调用链

1. 本地图片转为 `image_base64`
2. 调用 `POST /api/upload-image-base64`
3. 上传服务返回 `img_url`
4. 前端将 `img_url` 传给后续推荐接口或任务提交接口
