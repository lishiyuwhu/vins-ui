# Image Upload URL

本文档整理了图片上传接口接入方式，聚焦 `Image Upload URL` 本身，供当前工程内部存档使用。

---

## 环境变量

| 变量名 | 说明 | 示例值 |
|---|---|---|
| `NEXT_PUBLIC_IMAGE_UPLOAD_API_URL` | 浏览器直传图片上传服务完整 URL | `https://bluepixel.vivo.com.cn/api/upload-image` |
| `IMAGE_UPLOAD_API_URL` | 服务端 Base64 代理使用的图片上传服务完整 URL | `https://bluepixel.vivo.com.cn/api/upload-image-base64` |

上传服务同时支持两个入口：

- `POST /api/v1/upload-image-base64`：JSON + Base64/Data URL 上传，适合旧版或兼容调用方式。
- `POST /api/v1/upload-image`：`multipart/form-data` 文件上传，适合 curl、脚本、后端服务直接上传图片二进制内容。

---

## 接口概览

| 项 | 内容 |
|---|---|
| 前端调用路径 | `POST {NEXT_PUBLIC_IMAGE_UPLOAD_API_URL}` |
| 请求格式 | `multipart/form-data` |
| 文件字段名 | `file` |
| 用途 | 浏览器直接上传本地图片文件，获取图片 URL |

旧的 Base64 代理入口仍可保留给兼容调用方：

| 项 | 内容 |
|---|---|
| 服务端代理入口 | `POST /api/upload-image-base64` |
| 真实目标 | `POST {IMAGE_UPLOAD_API_URL}` |
| 请求格式 | `application/json` |
| 用途 | 上传 Base64 图片，获取图片 URL |

---

## 接口说明

### Base64 上传

兼容调用方可将本地图片文件读取为 Data URL，格式如下：

```text
data:<mime>;base64,<data>
```

随后将其发送到上传服务，换取一个可公开访问的图片 URL。该 URL 会被后续图片推荐和图片编辑任务接口继续使用。

### 文件二进制上传

对于 curl、Python 脚本或后端服务间调用，可以直接使用 `multipart/form-data` 上传图片文件，不需要把文件转成 Base64。

curl 示例：

```bash
curl -X POST \
  -F "file=@/path/to/image.png" \
  http://v-dev-gpu4-11168979-ccc-wl0102-vtraining.vmic.xyz/api/v1/upload-image
```

Python 示例：

```python
import requests

with open("image.png", "rb") as f:
    response = requests.post(
        "http://v-dev-gpu4-11168979-ccc-wl0102-vtraining.vmic.xyz/api/v1/upload-image",
        files={"file": ("image.png", f, "image/png")},
    )

print(response.json())
```

文件上传入口返回结构与 Base64 上传入口一致，成功时都会返回 `img_url`。

---

## Multipart Request

```http
Content-Type: multipart/form-data
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `file` | file | 是 | 本地图片文件 |

浏览器调用时不要手动设置 `Content-Type`，由浏览器自动生成 multipart boundary。

## Base64 Request Headers

```http
Content-Type: application/json
```

## Base64 Request Body

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
- 文件上传入口中 `file` 字段缺失或不是合法图片时，上传服务会返回非 2xx 错误。

---

## 相关调用链

### 当前前端文件直传调用链

1. 本地图片读取为 Data URL 用于页面预览
2. 以 `multipart/form-data` 调用 `POST {NEXT_PUBLIC_IMAGE_UPLOAD_API_URL}`，字段名为 `file`
3. 上传服务返回 `img_url`
4. 前端将 `img_url` 传给后续推荐接口或任务提交接口

### 兼容 Base64 调用链

1. 本地图片转为 `image_base64`
2. 调用 `POST /api/upload-image-base64`
3. 上传服务返回 `img_url`
4. 调用方将 `img_url` 传给后续推荐接口或任务提交接口
