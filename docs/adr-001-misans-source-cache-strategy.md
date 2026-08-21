# ADR-001: MiSans 全量源备份缓存策略评估

> **状态**: Proposed → 待 Jack 终审确认（本稿由 Harvey 撰写，Oscar Review）  
> **关联 Issue**: RAY-389 `01a022d6-9575-7255-827c-5a07b3fbba0b` — Parent RAY-387 `01a022b8`  
> **来源**: Oscar 复核 `01a022cb-20d5` S2、复核详审 `01a022cb-87e8` S2、Jack 终审 `01a022cc-2025` suggestion（均不阻断，提议评估克隆体积 trade-off）  
> **日期**: 2026-08-21  
> **Owner**: Harvey / Frontend · 协作者 Oscar Review · 决策人 Jack

---

## 1. 背景与现状

RAY-387 已 Done 并合入 `main@6693b0c7`，实现「按仓库实际用字自动化子集化」：`public/fonts/MiSans-VF.woff2` 11.6MB → 435KB（`pnpm fonts:subset` / `prebuild` 自动触发，实测 `fvar 150-700` / `GSUB ss04,tnum` 保留，27 pages 构建通过）。

为保证“无官方 TTF 时任何环境可复现”，`scripts/cache/MiSans-VF.src.woff2` 被有意**跟踪入库**（`git ls-files` 可见，11_602_732 bytes / 11.07 MiB，blob `37e0292`），不在 `public/` 故不被部署。脚本 `scripts/subset-misans.mjs:47-57` 已提供 7 级输入源优先级：

```
1) scripts/cache/MiSans-VF.src.woff2        ← 当前全量备份（首选）
2) public/fonts/MiSansVF.ttf                ← 官方 VF TTF（手动放置）
3) public/fonts/MiSans-VF.ttf
4) public/fonts/MiSans-VF.src.woff2         ← 旧路径（自动迁移 → 1）
5) scripts/cache/MiSans-VF.woff2 / .ttf
6) public/fonts/MiSans-VF.woff2             ← 回退（首次运行前即 11.6MB 全量 CJK）
7) scripts/cache/MiSans-VF.src.ttf / public/fonts/MiSans-VF.src.ttf
```

缺 `pyftsubset` 时 `findPyftsubset()` 三级探测后 `process.exit(0)` 非阻断，回退到 `Source Han Sans SC`，不影响 `pnpm build`。

**当前仓库体积实测**（`main@6693b0c7`，pack `8b8dbc0`）：

| 指标 | 值 |
|------|-----|
| `scripts/cache/MiSans-VF.src.woff2` 裸体积 | 11_602_732 bytes (11.07 MiB) |
| `public/fonts/MiSans-VF.woff2` 产物 | 445_928 bytes (435.5 KiB) |
| `git ls-files \| grep woff` 跟踪文件 | 4 files（见下） |
| `pack-8b8dbc0.pack` 整体 | 79 MiB，`size-pack` 80_508 KiB（`git count-objects`） |
| 单文件在 pack 中增量 | 约 11.6 MiB（woff2 已压缩，pack 几乎无二次压缩） |
| `git ls-tree -r -l HEAD` 中 woff 行 | `scripts/cache/MiSans-VF.src.woff2` 11_602_732 / `public/fonts/MiSans-VF.woff2` 445_928 / `ZhudouSansVF` 26_044 / `roboto-flex` 27_504 |

Oscar S2 与 Jack 终审均标记为 **suggestion 不阻断**，但提出：克隆体积 +11 MiB 且历史 blob 持续携带，需评估是否迁移至 LFS 或 CI 缓存。

---

## 2. 评估目标

对比 3 种方案在 4 维度（体积、复现性、CI/本地依赖、维护成本）上的权衡，给出团队决策记录、是否迁移及迁移步骤。**不影响**现有 `pnpm fonts:subset` / `prebuild`/`predev` 自动化与 `Source Han` 兜底是硬约束。

---

## 3. 方案详解

### 方案 1 — 维持入库（现状）

保持 `scripts/cache/MiSans-VF.src.woff2` 被 `git ls-files` 跟踪，任何 `git clone` 即可复现，无需额外工具或网络。

- 优点：零依赖、离线可构建、新人 onboarding 一条 `pnpm install && pnpm build` 直通；历史可追溯；脚本 7 级优先级中命中率最高。
- 代价：`git clone` 体积 +11 MiB；`git log --all --oneline -- scripts/cache` 永久携带该 blob，即使后续 `git rm` 也仍在历史中（需 `filter-repo` / BFG 重写历史才能彻底清理）。
- 部署影响：无。`scripts/` 不在 `public/`，`dist/` 不含该文件（已验证）。

### 方案 2 — Git LFS

将 `scripts/cache/*.woff2`（及可选 `*.ttf`）迁移至 LFS：`git lfs track "scripts/cache/*.woff2"` 写入 `.gitattributes`，仓库仅存指针（约 130 bytes），二进制托管于 LFS 服务。

- 优点：`git clone` 仅拉指针（克隆更快、浅克隆更小）；`git log` 历史仍可追溯；对脚本透明（`resolveSource()` 无需改动，检出后文件仍在同一路径）。
- 代价：新增依赖
  - 贡献者需安装 `git-lfs`（`git lfs install`），未安装时检出得到指针文本而非二进制，`pnpm build` 会回退到 `Source Han`（非阻断但易困惑）。
  - CI 需在 `actions/checkout` 启用 `lfs: true`（或 `git lfs pull`），否则同上。
  - GitHub LFS 配额：免费 1 GiB 存储 + 1 GiB/月 带宽，超出需付费；对 11 MiB 单文件当前够用，但团队需关注带宽。
  - 历史迁移需重写提交（`git lfs migrate import --include="scripts/cache/*.woff2"`），`main` 历史会被改写，需团队协调 `force push` 并通知所有本地分支 rebase。
- 适用场景：仓库体积成为瓶颈（如总体积 >200 MiB、或二进制资产增多）、或团队普遍已使用 LFS。

### 方案 3 — CI 缓存 / 本地可选缓存（不入库）

将全量源移出 Git 跟踪：`git rm --cached scripts/cache/MiSans-VF.src.woff2` 并加入 `.gitignore`（`scripts/cache/*.woff2`），文档化下载/缓存路径，依赖 CI 缓存或本地手动放置。

典型实现：

- **本地**：README 指引从 `https://hyperos.mi.com/font/zh/download` 下载 `MiSans VF`，放置到 `public/fonts/MiSansVF.ttf` 或 `scripts/cache/MiSans-VF.src.woff2`（脚本 7 级优先级已兼容，缺失时报错指引下载页）。
- **CI**：`actions/cache@v4` 缓存 `scripts/cache/MiSans-VF.src.woff2`（key 含文件哈希或固定 `misans-vf-src-v1`），未命中时回退到 `public/fonts/MiSans-VF.woff2`（已子集化的 435KB）或提示下载；也可将全量源作为 GitHub Release asset 私有托管，通过 `curl -L` 拉取（需额外 release 管理）。

- 优点：仓库体积最小（-11 MiB）；无 LFS 依赖；符合“大二进制不入库”最佳实践。
- 代价：复现性下降
  - 官方下载页 **需人工点击**，无稳定直链 `curl` 可用（截至 2026-08-21 实测 `hyperos.mi.com/font/zh/download` 为交互页），CI 无法自动拉取官方源，cache miss 时只能回退到已子集化的 435KB 产物再压，新增生僻字会丢失（回退到 Source Han 兜底，虽不阻断但体验降级）。
  - GitHub Actions cache 有 7 天未访问失效、10 GiB 仓库上限、分支隔离等限制，不保证 100% 命中；cold clone（新 contributor、CI 冷启动）首需手动下载。
  - 需维护额外文档与 CI 配置（cache restore-keys、fallback 逻辑），onboarding 复杂度上升。
- 适用场景：官方提供稳定直链或团队自建 Release asset CDN，且能接受“冷启动需手动下载”。

---

## 4. 对比总表

| 维度 | 方案 1：维持入库 ✅ 现状 | 方案 2：Git LFS | 方案 3：CI 缓存 / 本地可选缓存 |
|------|--------------------------|-----------------|--------------------------------|
| **克隆体积** | `clone` +11.1 MiB；`pack` 79 MiB 含该 blob；历史永久携带 | 指针 130 B，clone 轻；LFS 对象 11 MiB 存于 LFS 服务；历史指针化后旧 blob 仍需重写历史才彻底清理 | 仓库 -11.1 MiB，最轻；历史同方案 1（未重写前仍携带） |
| **复现性** | **最高**：任何 `git clone` 离线可 `pnpm fonts:subset` / `pnpm build`；无需网络；`resolveSource()` 100% 命中 | 高（需 LFS）：已安装 LFS 时等同方案 1；未安装时命中失败回退 Source Han | **最低**：cache hit 时等同方案 1；miss 时回退到 435KB 子集再压或需人工下载；新 clone 冷启动必手动 |
| **CI / 本地依赖** | 零额外依赖；CI 仅 `pnpm install` + `python -m fontTools` 可选 | 需 `git-lfs`（本地+CI）、`.gitattributes`、`checkout@v4 lfs:true`；未装时易得指针文本 | 需 `actions/cache` 配置 + 文档化下载路径；官方页无直链，CI 无法自动拉取；依赖 cache 命中率 |
| **维护成本** | 最低：1 个跟踪文件，无额外配置 | 中：LFS 安装/配额/历史重写成本；需团队培训；`force push` 协调 | 中高：CI cache 配置、Release asset 管理、文档同步、冷启动支持 |
| **风险** | 历史 blob 持续携带（即使 `git rm`）；克隆略慢（对 80 MiB 仓库增 ~14%） | LFS 未安装导致静默回退；配额超限；历史重写风险 | cache 失效/分支隔离导致构建回退；官方源不可 curl；新人文档负担 |
| **部署影响** | 无（`scripts/cache` 不部署，已验证 `dist` 仅 435KB） | 无 | 无 |
| **回滚难度** | 易（`git rm` 即可，后续历史仍带但不影响功能） | 需再次重写历史或保留 LFS | 易（重新 `git add` 即可） |
| **团队适配** | 单人博客 + 2-3 协作者，接受 +11 MiB 换零依赖 | 适合多人/多二进制仓库 | 适合有稳定 CDN 直链且接受冷启动手动的团队 |

**补充实测**：`scripts/subset-misans.mjs` 的 7 级优先级已兼容全部三方案——无论源来自 `scripts/cache`（方案1/2）、`public/fonts/MiSansVF.ttf`（方案3 手动放置）、或回退 `MiSans-VF.woff2`，均可产出 <1 MiB 子集，不阻断构建。

---

## 5. 决策记录（Decision）

**决策：维持方案 1（入库）不变，暂不迁移至 LFS 或 CI 缓存。**

**理由（按 Jack 终审 `01a022cc-2025` 已接受 trade-off 的延续）：**

1. **复现性 > 体积**：RayView 为单人运营博客，协作者仅 Harvey/Oscar/Jack 3 人，`+11 MiB` 对 `git clone`（约 80 MiB pack）增幅 ~14%，在可接受范围；换来的是任何环境（离线、新机、CI 冷启动）`pnpm build` 均能以全量为源重压，避免新增字丢失。
2. **官方源无稳定直链**：`hyperos.mi.com` 下载需人工点击，方案 3 在 CI 无 cache 时无法自动补齐，冷启动体验差于方案 1；待官方或团队自建 Release asset 提供稳定 `curl` 直链后，方案 3 才具备等价复现性。
3. **LFS 收益有限、成本显著**：当前仅 1 个 11 MiB 二进制，LFS 对克隆速度提升约 1-2 秒，但引入全员 `git-lfs` 依赖、CI `lfs: true`、配额与历史重写协调，对小团队 ROI 为负。
4. **不影响现有自动化**：`prebuild`/`predev: pnpm fonts:subset`（RAY-388 已 polish）与 `Source Han` 兜底在三方案下均保持，维持现状零改动、零风险。
5. **可逆性**：未来若触发下述阈值，可无损迁移至方案 2 或 3（脚本无需改动，仅调整 Git 跟踪与 CI 配置）。

**触发重评估的条件（任一满足即另起实施任务）：**

- 仓库 `pack` 总体积 >200 MiB 或二进制资产增至 ≥3 个 / ≥50 MiB
- 协作者增至 ≥5 人且普遍反馈克隆慢
- 官方或团队发布稳定直链（Release asset / 自建 CDN）可 `curl`，使方案 3 复现性等同方案 1
- GitHub LFS 配额/带宽成为瓶颈或团队已标准化 LFS

**决策有效期**：至上述条件触发或 2027-02-21（6 个月）复审，以先到者为准。

---

## 6. 如决策迁移 — 迁移方案与 README/脚本更新计划（另起实施任务，不在本单强制实施）

### 6.1 迁移至 Git LFS（方案 2）实施步骤

1. **准备**：团队公告，约定迁移窗口，提醒所有本地分支先 `git push` 并暂停新分支。
2. **配置**：`git lfs install`；`git lfs track "scripts/cache/*.woff2"` + `git lfs track "scripts/cache/*.ttf"` 生成 `.gitattributes`。
3. **历史重写**：`git lfs migrate import --include="scripts/cache/*.woff2,scripts/cache/*.ttf" --everything`（或仅 `main`：`--include-ref=refs/heads/main`）。
4. **校验**：`git lfs ls-files` 确认指针化；`ls -lh scripts/cache/MiSans-VF.src.woff2` 仍 11 MiB（本地 LFS 检出）；`git ls-files --stage | grep cache` 指针 hash。
5. **推送**：`git push --force --all` + `git push --force --tags`；通知团队 `git fetch --all && git rebase` 或重 clone。
6. **CI**：
   ```yaml
   - uses: actions/checkout@v4
     with:
       lfs: true
   ```
7. **文档**：更新 `public/fonts/README-MiSans.md` “源备份策略”小节（见 §7 草案 LFS 分支）、`docs/adr-001` 标记为 Superseded。
8. **脚本**：无需改动（`resolveSource()` 路径不变）；可选在 `subset-misans.mjs` 检测到指针文本时给出 `git lfs pull` 提示。
9. **回滚**：`git lfs migrate export` 或 revert 至迁移前 commit。

**预估工作量**：0.5 天（含团队协调）。

### 6.2 迁移至 CI 缓存 / 本地可选缓存（方案 3）实施步骤

1. **移出跟踪**：`git rm --cached scripts/cache/MiSans-VF.src.woff2`；`.gitignore` 新增：
   ```
   # MiSans 全量源（大二进制，本地可选缓存，不入库）
   scripts/cache/*.woff2
   scripts/cache/*.ttf
   !scripts/cache/.gitkeep
   ```
   `touch scripts/cache/.gitkeep && git add scripts/cache/.gitkeep .gitignore`。
2. **历史处理**：可选 `git filter-repo --path scripts/cache/MiSans-VF.src.woff2 --invert-paths` 重写历史以彻底减体积（需团队协调；若不重写则历史仍携带但后续 clone 增量不再增长）。
3. **CI 缓存**：`.github/workflows/deploy.yml` 新增：
   ```yaml
   - name: Restore MiSans source cache
     uses: actions/cache@v4
     with:
       path: scripts/cache/MiSans-VF.src.woff2
       key: misans-vf-src-${{ hashFiles('public/fonts/MiSans-VF.woff2') }}-v1
       restore-keys: misans-vf-src-
   - name: Fallback fetch (if cache miss & source absent)
     run: |
       if [ ! -f scripts/cache/MiSans-VF.src.woff2 ] && [ ! -f public/fonts/MiSansVF.ttf ]; then
         echo "::warning::MiSans 全量源未命中缓存，请按 README 指引手动放置或从 Release 拉取"
         # 可选：curl -L -o scripts/cache/MiSans-VF.src.woff2 https://github.com/RayySummers/raysview/releases/download/fonts-v1/MiSans-VF.src.woff2
       fi
   ```
4. **Release asset（可选但推荐）**：将 `MiSans-VF.src.woff2` 上传至 GitHub Release `fonts-v1`，作为稳定 `curl` 源，解决官方页无直链问题。
5. **文档**：更新 `public/fonts/README-MiSans.md` “源备份策略”小节（见 §7 草案 CI 缓存分支），补充 `scripts/cache/.gitkeep` 说明与 `pnpm fonts:subset` 在冷启动时的行为。
6. **脚本**：无需改动；`resolveSource()` 已覆盖 `MiSansVF.ttf` / `MiSans-VF.ttf` / 回退 `MiSans-VF.woff2`，CI cache miss 时自动回退到 Source Han 兜底。
7. **验证**：`git clone --depth 1` 新目录 `pnpm fonts:subset` 应提示缺源但 `pnpm build` 仍通过（Source Han 回退）；放置 `MiSansVF.ttf` 后重压应恢复 435KB。

**预估工作量**：0.5–1 天（含 Release 管理与 CI 调试）。

### 6.3 后续任务拆分建议

- **RAY-389-Impl-LFS**（如选方案 2）：执行 §6.1，全量回归 `pnpm fonts:subset` / `pnpm build` / `dist` 校验。
- **RAY-389-Impl-Cache**（如选方案 3）：执行 §6.2，含 Release asset 与 CI cache。
- 两个实施任务均需 Oscar Review + Jack 终审，验收同 RAY-387 4 项（<1MB、GSUB、27 pages、许可）。

---

## 7. `public/fonts/README-MiSans.md` 补充“源备份策略”小节草案

> 直接可粘贴至 `public/fonts/README-MiSans.md` 的 `## 自动化子集化` 之后、`## 许可` 之前。当前 RAY-389 仅产出草案，不直接修改文件，避免与 RAY-388 的 README polish 冲突；待本 ADR 获 Jack 确认后由实施任务应用。

```markdown
## 源备份策略（ADR-001）

> 决策（2026-08-21，RAY-389）：**维持 `scripts/cache/MiSans-VF.src.woff2` 跟踪入库**，保证任何 `git clone` 可离线复现；暂不迁移至 Git LFS 或 CI 缓存。详见 `docs/adr-001-misans-source-cache-strategy.md`。

### 现状

- `scripts/cache/MiSans-VF.src.woff2` 11.07 MiB（`git ls-files` 已跟踪，不在 `public/` 不部署）为全量源备份（`fvar 150-700` / `GSUB ss04` 完整，`27790 glyphs`）。
- `public/fonts/MiSans-VF.woff2` 435KB 为按仓库实际用字子集化产物（`1382 glyphs`，`<1MB`）。
- 首次运行 `pnpm fonts:subset` 时若 `scripts/cache` 缺失但 `public/fonts/MiSans-VF.woff2` 为 11.6MB 全量，会自动备份为 `scripts/cache/MiSans-VF.src.woff2`；旧路径 `public/fonts/MiSans-VF.src.woff2` 自动迁移。

### 为何不选 LFS / CI 缓存（当前）

- **LFS**：需全员安装 `git-lfs`、CI 配置 `lfs: true`、且需重写历史 `force push`，对单人博客 ROI 为负；仅当仓库总体积 >200 MiB 或二进制 ≥3 个时再评估。
- **CI 缓存**：官方下载页无稳定直链，CI cache miss 时无法自动补齐，冷启动需人工下载；GitHub cache 7 天失效、分支隔离，可靠性低于入库。待团队发布 Release asset 直链后可重评估。

### 本地/CI 行为

- `scripts/subset-misans.mjs` 7 级源优先级已兼容三方案，缺 `pyftsubset` 时警告跳过、构建不阻断，回退 `Source Han Sans SC`。
- `package.json: prebuild/predev: pnpm fonts:subset`，`pnpm build` / `pnpm dev` 前自动重压；偶发遗漏字符下次构建自动补齐。

### 何时重评估

仓库总体积 >200 MiB、协作者 ≥5 人、或官方/Release 提供稳定直链时，另起任务按 `docs/adr-001` §6 迁移至 LFS 或 CI 缓存。

### 迁移预案（不执行，仅记录）

- **LFS**：`git lfs track "scripts/cache/*.woff2"` + `migrate import` + `checkout lfs:true`。
- **CI 缓存**：`git rm --cached scripts/cache/*.woff2` + `.gitignore` + `actions/cache` + 可选 Release asset。
```

---

## 8. 验证与不影响声明

- `pnpm fonts:subset` / `prebuild` / `predev`（RAY-388 已改为 `pnpm fonts:subset`）均幂等，缺依赖 `exit 0` 不阻断，已验证。
- `pnpm build` 27 pages、`dist/assets` 双 `@font-face` 与 `time.font-date ss04` 未回归（采信 RAY-387 Oscar 双轨验证，无需重跑）。
- `scripts/subset-misans.mjs:113-122` RAY-388 已修复为 `status === 0` 校验，N1 已闭环；`package.json` 重复字面量已收敛为 `prebuild: pnpm fonts:subset`。
- 本 ADR 不改动任何构建产物或脚本逻辑，仅新增 `docs/` 文档；对现有自动化与 `Source Han` 兜底 **零影响**。

---

## 9. 附录

### 9.1 关联提交与文件

- `7826604a` RAY-387 实现：`scripts/subset-misans.mjs` 275 行、`scripts/cache/MiSans-VF.src.woff2` 新增、`public/fonts/MiSans-VF.woff2` 11.6MB→435KB。
- `6693b0c7` Merge to `main`。
- RAY-388（`01a022d6-780e`）已 polish：`predev` 新增、`prebuild: pnpm fonts:subset`、`findPyftsubset` 状态校验、README `prebuild/predev` 文案对齐（本 ADR 基于该 polish 后的状态撰写）。

### 9.2 参考

- Git LFS 官方文档：`git lfs track` / `migrate import` / `actions/checkout lfs:true`
- GitHub Actions cache：`actions/cache@v4`（7 天失效、10 GiB 上限、分支隔离）
- `fontTools` `pyftsubset`：`--text-file` / `--layout-features=ss04,tnum,liga,kern` / `--flavor=woff2`
- 小米 MiSans 官方下载：`https://hyperos.mi.com/font/zh/download`（需人工交互）

### 9.3 审核清单

- [x] 对比表格含 体积、复现性、CI/本地依赖、维护成本 4 维度
- [x] 明确是否迁移及触发条件
- [x] 如迁移，给出迁移方案与 README/脚本更新计划（§6）
- [x] 产出 `docs/` 决策文档 + `README-MiSans.md` “源备份策略”小节草案（§7）
- [x] 不影响现有自动化与兜底
- [ ] Oscar Review（pending）
- [ ] Jack 确认接受当前或新方案（pending）

---

*— Harvey, 2026-08-21*
