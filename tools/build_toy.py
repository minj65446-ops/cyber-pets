#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 cyber-pets/ 打成 B站 Toy 能直接上传的 zip。

平台约束（来自官方 FAQ 与 toy skill 的自检清单，2026-10 版）：
  - 包体 ≤ 50 MB；入口 index.html 解压后 ≤ 1 MB（硬上限，超了服务端 307000 拒收）
  - zip 根目录下必须有 index.html
  - 只保留白名单后缀，其余文件会被平台丢弃
  - 页面里的资源必须用相对路径，绝对路径会在 /toy/<slug>/ 下白屏

用法：
  python tools/build_toy.py            # 产出 dist/cyber-pets-toy.zip
  python tools/build_toy.py --check    # 只体检，不打包
"""
import os
import re
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'cyber-pets')
DIST = os.path.join(ROOT, 'dist')
OUT = os.path.join(DIST, 'cyber-pets-toy.zip')

# 白名单（页面/代码/数据 + 图片 + 字体 + 音视频）
ALLOW_EXT = {
    '.html', '.htm', '.css', '.js', '.json', '.wasm', '.data', '.md', '.csv', '.tsv',
    '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico',
    '.woff2', '.woff', '.ttf', '.eot',
    '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm',
}

# 不进包的：小程序镜像页（内嵌了另一套快照，160 KB，与网页版玩法无关）
EXCLUDE = {'mp-preview.html'}

ENTRY_MAX = 1024 * 1024
PACK_MAX = 50 * 1024 * 1024


def collect():
    files = []
    for name in sorted(os.listdir(SRC)):
        p = os.path.join(SRC, name)
        if not os.path.isfile(p):
            continue
        if name in EXCLUDE:
            continue
        ext = os.path.splitext(name)[1].lower()
        if ext not in ALLOW_EXT:
            print('  [跳过] 白名单外：%s' % name)
            continue
        files.append(name)
    return files


def check(files):
    errors, warns = [], []
    if 'index.html' not in files:
        errors.append('包根缺少 index.html（Toy 必须有入口）')

    entry = os.path.join(SRC, 'index.html')
    esz = os.path.getsize(entry)
    if esz > ENTRY_MAX:
        errors.append('入口 index.html %.0f KB 超过 1 MB 硬上限' % (esz / 1024))

    total = sum(os.path.getsize(os.path.join(SRC, f)) for f in files)
    if total > PACK_MAX:
        errors.append('包体 %.1f MB 超过 50 MB 上限' % (total / 1048576))

    # 绝对路径会导致 /toy/<slug>/ 下白屏
    bad_abs = []
    for f in files:
        if not f.endswith(('.html', '.htm', '.css')):
            continue
        txt = open(os.path.join(SRC, f), encoding='utf-8', errors='ignore').read()
        for m in re.finditer(r'(?:src|href)\s*=\s*["\'](/[^/"\']+)', txt):
            bad_abs.append('%s → %s' % (f, m.group(0)))
    if bad_abs:
        errors.append('发现绝对路径（会白屏）：' + '; '.join(bad_abs[:5]))

    # 外部网络依赖：Toy 允许但审核与加载都更脆，这里只提醒
    for f in files:
        if not f.endswith(('.html', '.css')):
            continue
        txt = open(os.path.join(SRC, f), encoding='utf-8', errors='ignore').read()
        ext = re.findall(r'(?:src|href)\s*=\s*["\'](https?://[^"\']+)', txt)
        if ext:
            warns.append('%s 引用了外部资源：%s' % (f, ext[:3]))

    return errors, warns, total, esz


def build(files):
    if not os.path.isdir(DIST):
        os.makedirs(DIST)
    with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in files:
            z.write(os.path.join(SRC, f), arcname=f)   # 平铺：zip 根目录就是入口目录
    return OUT


def main():
    only_check = '--check' in sys.argv
    files = collect()
    errors, warns, total, esz = check(files)

    print('=' * 52)
    print('Toy 打包体检 · cyber-pets/')
    print('=' * 52)
    for f in files:
        print('  %8.1f KB  %s' % (os.path.getsize(os.path.join(SRC, f)) / 1024, f))
    print('-' * 52)
    print('  文件数 %d　合计 %.0f KB　入口 index.html %.1f KB（上限 1024 KB）'
          % (len(files), total / 1024, esz / 1024))
    for w in warns:
        print('  [WARN] ' + w)
    if errors:
        for e in errors:
            print('  [ERROR] ' + e)
        print('\n体检未通过，未打包。')
        return 1
    print('  体检通过：白名单内、相对路径、入口体积合规')

    if only_check:
        print('（--check 模式，只体检不打包）')
        return 0

    out = build(files)
    print('\n已产出：%s（%.0f KB）' % (out, os.path.getsize(out) / 1024))
    print('\n上传 / 预览（拿到 Toy 权限并 toy login 之后；以下命令未验证，先用 toy --help 核对）：')
    print('  toy create --package dist/cyber-pets-toy.zip \\')
    print('             --title "赛博人物志" --slug cyber-pets \\')
    print('             --poster assets/cover.png --icon assets/icon.png')
    print('  # 先拿 preview_url 自查，再同参数加 --yes 提交审核')
    print('  toy video bind <toy-id> --bvid <你的视频BV号>')
    return 0


if __name__ == '__main__':
    sys.exit(main())
