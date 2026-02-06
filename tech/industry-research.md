# 大型聊天软件技术调研报告

## 一、核心结论

**几乎没有大型聊天软件是完全从零开始的。** 它们都站在开源项目的肩膀上，然后逐步魔改。

大厂的路径基本是三步走：

```
第一步：基于开源项目快速搭建
        （WhatsApp 用 ejabberd，Discord 用 Elixir，Slack 用 PHP+MySQL）
            ↓
第二步：随着规模增长，逐步替换和魔改
        （改协议、换数据库、重写性能瓶颈）
            ↓
第三步：把自研的通用组件开源回馈社区
        （腾讯的 TARS/Mars，LINE 的 Armeria，Facebook 的 RocksDB/Thrift）
```

---

## 二、各大厂技术底座详解

### 1. WhatsApp

| 属性 | 详情 |
|------|------|
| 起步基础 | **ejabberd**（开源 Erlang XMPP 服务器） |
| 后端语言 | 几乎全部是 **Erlang**，运行在 **FreeBSD** 上 |
| 协议演进 | 标准 XMPP → 自研 **FunXMPP**（XMPP 的二进制编码版本，更紧凑） |
| 加密 | 2016 年全面采用 **Signal Protocol** 端到端加密 |
| 数据库 | Mnesia（Erlang 原生分布式数据库）用于临时消息存储 |
| 规模（2014 年被收购时） | 每天 420 亿条消息，~50 名工程师，8000+ 核心，7000 万+ Erlang 消息/秒 |

**关键故事：** WhatsApp 的两位创始人在 Yahoo 有丰富的 FreeBSD 经验，所以选了 Erlang + FreeBSD 这条非主流但极其高效的路线。他们对 ejabberd 做了大量魔改，甚至修改了 Erlang 虚拟机本身来优化性能。

### 2. Telegram

| 属性 | 详情 |
|------|------|
| 协议 | **MTProto 2.0**（Nikolai Durov 自研） |
| 服务端 | **闭源**，据信主要是 C++ |
| 客户端 | **开源**（Android: Java/Kotlin, iOS: Swift/ObjC, Desktop: C++/Qt） |
| 核心库 | **TDLib**（Telegram Database Library）— C++ 跨平台库，所有官方客户端基于此构建 |

**特点：** Telegram 是少数从头自研协议的公司。MTProto 协议包含三层：API 查询语言层、加密/授权层、传输层（支持 HTTP/HTTPS/WS/WSS/TCP/UDP）。服务端完全闭源不可自建，但社区有 Go 语言实现的非官方服务端 teamgram-server。

### 3. Discord

| 属性 | 详情 |
|------|------|
| 实时通信层 | **Elixir**（运行在 Erlang VM 上） |
| API 层 | **Python** 单体应用 |
| 性能关键路径 | **Rust**（逐步替换 Go 和部分 Elixir） |
| 数据库演进 | MongoDB → Apache Cassandra（177 节点）→ **ScyllaDB**（72 节点，p99 延迟从 40-125ms 降到 15ms） |

**关键故事：**
- Discord 是 Elixir 语言的早期采用者（2015 年 Elixir 1.0 刚发布）
- 用 Rust 替换 Go 写的 Read States 服务后，延迟大幅下降
- 通过 Rustler 库在 Elixir 中调用 Rust NIF，性能提升 6.5x - 160x
- 从 Cassandra 迁移到 ScyllaDB（C++ 实现的 Cassandra 兼容数据库），节点减少 60%，延迟大幅改善

### 4. Slack

| 属性 | 详情 |
|------|------|
| 起步 | **LAMP 栈**（Linux + Apache + MySQL + PHP），从失败的游戏公司 Tiny Speck 剥离 |
| 后端演进 | PHP → Facebook 的 **Hack**（静态类型、JIT 编译的 PHP 变体） |
| 数据库 | MySQL + **Vitess**（Google/YouTube 开源的 MySQL 分片方案） |
| 实时通信 | WebSocket，HAProxy 负载均衡 |
| 客户端 | Electron + React + Redux |
| 基础设施 | AWS 全家桶（EC2、CloudFront、ELB、Route 53） |

### 5. 微信（WeChat）

| 属性 | 详情 |
|------|------|
| 消息路由 | **Erlang** |
| 核心服务 | **C++** |
| 协议 | **MMTLS**（基于 TLS 1.3 的自研修改版，双层加密） |
| 微服务框架 | **TARS**（2008 年开始使用，现为 Linux 基金会项目） |

**开源贡献：**
- **Mars** — 跨平台网络组件（C++），包含 STN（信令传输网络）、Xlog（日志）、Comm（Socket/线程/协程）
- **TARS** — 高性能 RPC/微服务框架，支持 C++/Go/Java/Node.js/PHP，百万微服务节点在生产环境运行
- **TSeer** — 服务发现与负载均衡
- **libco** — C++ 协程库

### 6. QQ

| 属性 | 详情 |
|------|------|
| 核心框架 | **TARS**（与微信共用同一套微服务框架） |
| 主要语言 | C++（历史主力）+ Go（逐步增长） |
| 服务发现 | **TSeer**，每天处理数百亿请求 |
| 协议 | 私有闭源 |

### 7. LINE

| 属性 | 详情 |
|------|------|
| 规模 | 2 亿+ 月活，每天 250 亿条消息，峰值 42 万条/秒 |
| 后端语言 | **Java**（主力）+ Erlang |
| RPC/序列化 | Apache **Thrift** |
| 消息队列 | Apache **Kafka**（深度定制） |
| 缓存 | **Redis** |
| 数据存储 | **HBase** |

**开源贡献：** **Armeria** — Java 微服务框架，基于 Netty，同时支持 gRPC + Thrift + REST。由 Netty 的作者 Trustin Lee 创建。

### 8. Signal

| 属性 | 详情 |
|------|------|
| 开源程度 | **全部开源**（AGPL-3.0）— 服务端、客户端、加密库 |
| 服务端 | Java + Dropwizard + FoundationDB + Redis |
| 加密协议 | **Signal Protocol**（Double Ratchet + Prekeys + 3-DH） |
| 核心加密库 | **libsignal**（Rust 实现） |

**被采用情况：** Signal Protocol 已成为端到端加密的事实标准，被 WhatsApp（10 亿+用户）、Google Messages、Facebook Messenger、Skype 采用。

### 9. Facebook Messenger

| 属性 | 详情 |
|------|------|
| Channel 服务器 | **Erlang**（Mochiweb） |
| 内部通信 | Apache **Thrift** |
| 消息队列 | 自研 **Iris**（全序消息队列） |
| 存储 | HBase → **MyRocks**（RocksDB 作为 MySQL 存储引擎） |
| XMPP 历史 | 2008 年支持 XMPP，2015 年彻底关闭 |

**Project LightSpeed（2020）：** iOS 客户端大重写，代码从 170 万行减到 36 万行（减少 84%），启动速度翻倍，体积缩小到 1/4。核心思路：SQLite 作为客户端统一存储系统。

---

## 三、关键开源协议/项目

### XMPP (ejabberd)

| 属性 | 详情 |
|------|------|
| 类型 | IM 协议 + 服务器实现 |
| 架构 | 联邦式客户端-服务器（类似 Email） |
| 关键实现 | ejabberd（Erlang） |
| 数据格式 | XML |
| 谁用过 | WhatsApp、Facebook Messenger、Google Talk |
| 现状 | 三家都已抛弃 XMPP，转向私有协议 |

**为什么被抛弃：** 不是技术问题，而是商业策略。XMPP 的联邦架构支持互操作，但公司们希望将用户锁定在自己的生态中。

### Matrix

| 属性 | 详情 |
|------|------|
| 类型 | 去中心化 IM 协议 |
| 参考服务器 | Synapse（Python）、Dendrite（Go） |
| 数据格式 | JSON over HTTP |
| 适合场景 | 组织级聊天、跨平台桥接 |

### Signal Protocol

| 属性 | 详情 |
|------|------|
| 类型 | 端到端加密协议（不是传输协议） |
| 核心算法 | Double Ratchet、Prekeys、Triple DH |
| 密码学原语 | Curve25519、AES-256、HMAC-SHA256 |
| 核心库 | libsignal（Rust） |
| 谁在用 | WhatsApp、Google Messages、Facebook Messenger、Skype |

### MQTT

| 属性 | 详情 |
|------|------|
| 类型 | 发布/订阅传输协议 |
| 架构 | 中心化 Broker |
| 适合场景 | IoT、机器间通信、带宽受限环境 |
| IM 中的应用 | Facebook Messenger 用于移动端推送通知 |

### 协议对比

| | XMPP | Matrix | Signal Protocol | MQTT |
|---|---|---|---|---|
| 类型 | 传输 + IM | 传输 + IM | 仅加密 | 传输（发布/订阅） |
| 架构 | 联邦式 | 去中心化 | N/A（叠加层） | 中心化 Broker |
| 规模上限 | 百万级 | 千级 | N/A | 受限于 Broker |
| 主要领域 | IM、在线状态 | 群聊、桥接 | 任意传输层的 E2EE | IoT |

---

## 四、IM 云服务（BaaS）

不自建后端，直接用 IM SDK 的方案：

### 国内

| 平台 | 关键优势 |
|------|---------|
| **腾讯云 IM** | 微信/QQ 同款基础设施，简单的 DAU 计费 |
| **网易云信** | 最全面，600+ CDN 节点，覆盖 196 个国家 |
| **融云** | 灵活部署（公有云/私有云/专属云），社交和游戏场景强 |
| **环信** | 国内最早的 IM 云服务商，客服 + RTC 场景强 |
| **LeanCloud** | 开发者友好，适合初创和原型 |

### 国外

| 平台 | 关键优势 |
|------|---------|
| **Sendbird** | 功能丰富，AI 聊天机器人，全渠道 |
| **Stream (GetStream)** | 聊天 API + 动态流，全球边缘网络，500 万并发连接 |
| **CometChat** | 应用内聊天与通话，支持私有部署 |
| **PubNub** | 底层发布/订阅基础设施 |

---

## 五、总结对比表

| 应用 | 起步基础 | 现在的核心 | 关键变化 |
|------|---------|-----------|---------|
| **WhatsApp** | ejabberd (XMPP) | 自研 Erlang + FunXMPP | 重写协议，深度魔改服务器和 VM |
| **Telegram** | 从头自研 | 私有 C++ 服务端 + MTProto | 一直是私有服务端 |
| **微信** | Erlang + C++ | Erlang 路由 + TARS 微服务 | 自研 MMTLS、Mars、TARS |
| **Discord** | Elixir + MongoDB | Elixir + Rust + ScyllaDB + Python | 换数据库，加 Rust 提性能 |
| **Slack** | PHP + MySQL (LAMP) | Hack + MySQL/Vitess + WebSocket | 语言迁移，分片，边缘缓存 |
| **LINE** | Java + Thrift | Java + Thrift + Kafka + HBase + Armeria | 自研 Armeria 框架，深度定制 Kafka |
| **Signal** | Java + 开源全栈 | Java + FoundationDB + Redis | 始终全部开源 |
| **FB Messenger** | Erlang + XMPP | Erlang + Thrift + MyRocks + Iris | 全面自研，抛弃 XMPP |
| **QQ** | C++ + TARS | C++ + Go + TARS | TARS 持续演进，加入 Go |

---

## 六、对本项目（ChatGroup）的启示

1. **不需要从零造轮子**：大厂都是基于开源起步的
2. **先跑起来再优化**：WhatsApp 用最简单的 ejabberd 支撑了早期所有用户
3. **技术栈选自己熟悉的**：Slack 用 PHP，Discord 用 Elixir，没有标准答案
4. **AI 总结是差异化能力**：这是现有大型聊天软件都没有内置的功能，是本项目的核心价值
5. **两人使用的规模下**，Node.js + React + PostgreSQL + Socket.io 完全足够，不需要 Erlang 级别的并发能力
