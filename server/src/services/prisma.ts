/**
 * Prisma 客户端单例
 *
 * 【什么是 Prisma？】
 * Prisma 是一个 ORM（对象关系映射）工具。
 * 它让你用 TypeScript 代码操作数据库，而不需要手写 SQL 语句。
 *
 * 比如：prisma.user.findMany() 等价于 SELECT * FROM users
 *
 * 【为什么要单例？】
 * 数据库连接是昂贵的资源，不能每次请求都新建一个连接。
 * 整个应用共用一个 PrismaClient 实例，它内部维护一个连接池。
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export default prisma;
