# 敏感配置管理方案

## 一、问题说明

ChatGroup 涉及以下敏感信息：

| 敏感信息 | 存储位置 | 当前方案 |
|----------|---------|---------|
| 数据库密码 | `.env` 文件 | 环境变量 |
| JWT 密钥 | `.env` 文件 | 环境变量 |
| 用户的 AI API Key | PostgreSQL 数据库 | 明文存储 |
| 用户密码 | PostgreSQL 数据库 | bcrypt 哈希（安全） |

其中，**用户密码**已经通过 bcrypt 加密存储，是安全的。主要需要关注的是：
1. `.env` 文件中的服务器密钥
2. 数据库中明文存储的 AI API Key

## 二、当前方案的风险

### `.env` 环境变量

- `.env` 已在 `.gitignore` 中，不会被提交到 Git
- 风险：服务器被入侵时可能泄露
- 级别：**中等风险**（个人项目可以接受）

### AI API Key 明文存储

- 存在数据库 `UserAIConfig.apiKey` 字段中
- 前端展示时已做脱敏（只显示前 8 位）
- 风险：数据库泄露会导致所有用户的 API Key 暴露
- 级别：**需要关注**

## 三、推荐的改进方案

根据不同场景，提供三个递进的方案：

---

### 方案一：应用层加密（推荐，改动最小）

在保存 API Key 前用 AES-256 加密，读取时解密。加密密钥存在环境变量中。

**原理：**
```
存储：apiKey → AES-256加密(apiKey, 环境变量密钥) → 存入数据库
读取：数据库密文 → AES-256解密(密文, 环境变量密钥) → 使用明文调用API
```

**实现步骤：**

1. 在 `.env` 中新增一个加密密钥：
```bash
# .env
ENCRYPTION_KEY=用openssl-rand-base64-32生成的密钥
```

2. 创建加密工具 `server/src/services/crypto.ts`：
```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '', 'base64');

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  // 格式：iv:tag:密文
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, tagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

3. 在保存和读取 API Key 时调用：
```typescript
// 保存时加密
const encryptedKey = encrypt(apiKey);
await prisma.userAIConfig.upsert({ ..., apiKey: encryptedKey });

// 读取时解密
const config = await prisma.userAIConfig.findUnique({ ... });
const realKey = decrypt(config.apiKey);
```

**优点：** 改动小，数据库泄露时 API Key 无法直接使用
**缺点：** 加密密钥仍在环境变量中

---

### 方案二：云密钥管理服务

使用云服务商的密钥管理服务（KMS）来管理敏感信息。

#### 选项 A：HashiCorp Vault（自建）

适合对数据隐私要求极高的场景：

```
应用 → Vault API → 获取密钥/解密
                 → 审计日志
                 → 密钥自动轮换
```

- 用 Docker 部署 Vault
- 所有密钥通过 Vault API 获取
- 支持动态密钥、自动轮换、访问审计

#### 选项 B：云厂商 KMS

如果服务器在云上，可以使用：

| 云厂商 | 服务 | 特点 |
|--------|------|------|
| 阿里云 | KMS 密钥管理服务 | 国内首选，有免费额度 |
| 腾讯云 | SSM 凭据管理系统 | 与腾讯云生态集成 |
| AWS | Secrets Manager | 功能最全 |

使用方式：
```typescript
// 以阿里云 KMS 为例
import KmsClient from '@alicloud/kms20160120';

const client = new KmsClient({ ... });
const result = await client.decrypt({ CiphertextBlob: encryptedApiKey });
const apiKey = result.body.Plaintext;
```

**优点：** 专业级安全，支持审计和轮换
**缺点：** 增加外部依赖，有使用成本

---

### 方案三：对象存储 + 加密配置文件

将敏感配置存储在加密的配置文件中，托管在对象存储上。

**流程：**
```
1. 本地创建配置文件（包含所有密钥）
2. 用 GPG 或 AES 加密配置文件
3. 上传加密文件到对象存储（如 阿里云 OSS、腾讯云 COS）
4. 应用启动时从对象存储下载并解密
```

**具体步骤：**

```bash
# 1. 创建敏感配置文件
cat > secrets.json << EOF
{
  "DB_PASSWORD": "xxx",
  "JWT_SECRET": "xxx",
  "ENCRYPTION_KEY": "xxx"
}
EOF

# 2. 加密
openssl enc -aes-256-cbc -salt -in secrets.json -out secrets.json.enc -pass pass:你的主密码

# 3. 上传到对象存储
# 阿里云 OSS
ossutil cp secrets.json.enc oss://your-bucket/config/secrets.json.enc

# 4. 应用启动时下载解密
```

启动脚本修改：
```bash
#!/bin/sh
# docker-entrypoint.sh

# 从 OSS 下载加密配置
wget "https://your-bucket.oss-cn-hangzhou.aliyuncs.com/config/secrets.json.enc" -O /tmp/secrets.enc

# 解密（MASTER_PASSWORD 通过环境变量传入）
openssl enc -aes-256-cbc -d -in /tmp/secrets.enc -out /tmp/secrets.json -pass pass:$MASTER_PASSWORD

# 将解密后的配置导入环境变量
export $(jq -r 'to_entries | .[] | "\(.key)=\(.value)"' /tmp/secrets.json | xargs)

# 清理临时文件
rm -f /tmp/secrets.enc /tmp/secrets.json

# 正常启动
npx prisma migrate deploy
node dist/app.js
```

**对象存储费用参考：**

| 服务 | 存储费用 | 说明 |
|------|---------|------|
| 阿里云 OSS | ~0.12 元/GB/月 | 一个配置文件几乎免费 |
| 腾讯云 COS | 免费额度 50GB | 个人使用完全免费 |
| 七牛云 | 免费额度 10GB | 个人使用免费 |

**优点：** 配置文件不在服务器上，需要主密码才能解密
**缺点：** 增加启动复杂度，需要管理对象存储

---

## 四、方案对比

| | 方案一：应用层加密 | 方案二：云 KMS | 方案三：对象存储 |
|---|---|---|---|
| **安全级别** | 中 | 高 | 中高 |
| **改动量** | 小（加几个函数） | 中（引入 SDK） | 中（改启动脚本） |
| **额外成本** | 无 | KMS 服务费 | 对象存储费（几乎免费） |
| **运维复杂度** | 低 | 中 | 中 |
| **适合场景** | 个人/小团队 | 企业级 | 个人/小团队 |

## 五、推荐策略

对于 ChatGroup 这样的个人项目，建议：

1. **短期**（现在）：使用 **方案一（应用层加密）**
   - 在数据库中加密存储 API Key
   - 加密密钥存在 `.env` 环境变量中
   - 改动量最小，安全性显著提升

2. **中期**（如果用户增多）：**方案一 + 对象存储备份**
   - 继续使用应用层加密
   - 将 `.env` 的加密版本备份到对象存储
   - 方便服务器迁移时恢复配置

3. **长期**（如果走向正式产品）：**方案二（云 KMS）**
   - 所有密钥通过 KMS 管理
   - 启用访问审计和密钥轮换

## 六、通用安全建议

无论选择哪个方案，以下措施都应执行：

- `.env` 文件已在 `.gitignore` 中，**永远不要提交到 Git**
- 定期更换 JWT 密钥和数据库密码
- 服务器开启防火墙，只暴露必要端口
- 使用 HTTPS 加密传输
- 定期备份数据库
- 数据库端口不对外暴露（Docker 内部网络已自动实现）
