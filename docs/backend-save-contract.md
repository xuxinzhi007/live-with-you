# Wenbebi 匿名存档接口契约

> 状态：匿名设备存档原型，尚未接入生产数据库。它适合验证单设备快照上传，不提供可靠的账号跨设备同步。长期目标、N100/MySQL 安全边界和离线重试设计见[离线优先存档与云同步设计](./offline-first-save-design.md)。

这是 Wenbebi 与存档后端之间的最小匿名存档协议。接口不接触 Companion、Pet 或 Game 的其他用户态数据。

## Endpoint

```text
POST /api/wenbebi/save
Content-Type: application/json
```

请求体：

```json
{
  "deviceId": "客户端生成的 UUID",
  "clientUpdatedAt": 1730000000000,
  "snapshot": {
    "schemaVersion": 1,
    "updatedAt": 1730000000000,
    "deviceId": "客户端生成的 UUID",
    "state": {}
  }
}
```

服务端应按 `deviceId` 唯一保存最新快照，建议限制请求体 256 KB，并限制单设备写入频率。服务端只返回保存结果，不运行模型、不修改游戏规则。

```json
{
  "ok": true,
  "serverUpdatedAt": 1730000000000,
  "schemaVersion": 1
}
```

## 读取

```text
GET /api/wenbebi/save?deviceId=<uuid>
```

没有存档时返回 `404`；有存档时返回同一个 `snapshot` 对象。客户端只在本地没有存档或用户主动执行“恢复云端存档”时读取，避免覆盖离线进度。

## 安全边界

- `deviceId` 只作为匿名设备标识，不当作登录凭证。
- 不上传照片二进制，照片继续保存在本地；以后单独增加媒体上传协议。
- 服务端需要校验 `schemaVersion`、快照大小和 JSON 结构。
- 后续登录时再增加匿名档案迁移，不改变当前协议。
