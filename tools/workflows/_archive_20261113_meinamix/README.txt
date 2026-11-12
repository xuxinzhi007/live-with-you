归档日期：2026-11-13（Asia/Shanghai）
原因：用户确认官方 Qwen Q4 出图没有问题后，要求把旧工作流归档，避免再误开、误排队旧模式。

本目录是已退役的官方 MeinaMix 生产图（换装抠图 / 姿势训练集 v2，以及它们在 live 目录里的 .bak*）。
路径是旧的 IPAdapter / OpenPose / FaceDetailer 七组锁脸锁姿，以及姿势训练集 v2，不要再当作现行官方出图。

现行官方出图（仍留在 live workflows，未归档）：
  Qwen_Image_Edit_2509_Q4_官方出图.json
实验对照（仍留在 Comfy live workflows，不是旧 MeinaMix 模式）：
  Qwen_Image_Edit_2509_Q4_experimental.json

未删除 LoRA、底模、姿势/参考图或出图结果。更早的 _archive_20261106 / _archive_20261108 / _archive_20261111 保持不动。

历史回放（非官方）需要显式加 --legacy-meinamix，见 tools/run-official-dress.py 与 tools/run-official-dress.mjs。

本目录移入的文件：
- MeinaMix_雯宝LoRA_换装抠图.json
    from: C:\Users\ZhuanZ1\Desktop\wenbebi\tools\workflows\MeinaMix_雯宝LoRA_换装抠图.json
    size: 65497
    sha256: 977a76f5d58fdfa1bd44f358e0360fe0072549f9f0e8e1ee01e9f36334840f24
- MeinaMix_雯宝LoRA_换装抠图.json.bak-20261111-official-before-face-chibi-relock
    from: C:\Users\ZhuanZ1\Desktop\wenbebi\tools\workflows\MeinaMix_雯宝LoRA_换装抠图.json.bak-20261111-official-before-face-chibi-relock
    size: 46987
    sha256: a2382143e049db054ca655c26573acbd45de478a4398eda05d1366871b2488f5
- MeinaMix_雯宝LoRA_换装抠图.json.bak-20261111-official-before-seven-group-features
    from: C:\Users\ZhuanZ1\Desktop\wenbebi\tools\workflows\MeinaMix_雯宝LoRA_换装抠图.json.bak-20261111-official-before-seven-group-features
    size: 47631
    sha256: 5655cb1c4cc549dd6160acbc8ce7037f610cefee04c716d016820fd869dc4139
- MeinaMix_雯宝LoRA_换装抠图.json.bak_20261113
    from: C:\Users\ZhuanZ1\Desktop\wenbebi\tools\workflows\MeinaMix_雯宝LoRA_换装抠图.json.bak_20261113
    size: 65492
    sha256: e8d4232d01fd5f9cba640627975fd89ec2d1d1537865a492131f45d248d50adf
