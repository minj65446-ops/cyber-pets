#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""重生 cyber-pets/mp-preview.html —— 浏览器镜像预览页。

做法：复用现有预览页的外壳（样式 + CommonJS 加载器 + 触控驱动代码），
只把中间 9 个内嵌模块的源码换成 mp/ 下的当前版本。

这样预览页永远跟 mp/ 同步，不会再出现「页里内嵌的是旧数据」这种情况。

用法：python tools/build_mp_preview.py [--check]
"""
import io, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TARGET = os.path.join(ROOT, 'cyber-pets', 'mp-preview.html')

# 顺序必须与加载器里的依赖顺序一致（data 在前，app 最后）
MODULES = [
    'data.js',
    'portrait.js',
    'core/ui.js',
    'core/store.js',
    'core/battle.js',
    'core/face.js',
    'core/app.js',
    'core/scene_ov.js',
    'core/scene.js',
]

MARKER = re.compile(r'/\* ===== ([\w./]+) ===== \*/')
HEAD_FMT = '__mods["%s"] = function (module, exports, require) {\n'


def read(p):
    with io.open(p, encoding='utf-8') as f:
        return f.read()


def main():
    check_only = '--check' in sys.argv
    if not os.path.exists(TARGET):
        raise SystemExit('找不到模板：%s（首次生成需要手写外壳）' % TARGET)

    html = read(TARGET)
    original_len = len(html)

    marks = [(m.start(), m.group(1)) for m in MARKER.finditer(html)]
    found = [n for _, n in marks]
    missing = [n for n in MODULES if n not in found]
    if missing:
        raise SystemExit('模板里找不到这些模块标记：%s' % missing)

    # 从后往前替换，避免前面的替换影响后面的偏移
    stats = []
    for idx in range(len(marks) - 1, -1, -1):
        pos, name = marks[idx]
        if name not in MODULES:
            continue
        end_bound = marks[idx + 1][0] if idx + 1 < len(marks) else html.index('</script>', pos)
        seg = html[pos:end_bound]
        head = HEAD_FMT % name
        if head not in seg:
            raise SystemExit('模块 %s 的头部不在预期位置' % name)
        h = seg.index(head) + len(head)
        body_end = seg.rindex('\n};')          # 模块源码以 "\n};" 收尾

        src_path = os.path.join(ROOT, 'mp', name.replace('/', os.sep))
        src = read(src_path)
        if '</script' in src.lower():
            raise SystemExit('%s 含 </script>，直接内嵌会截断页面，需要转义' % src_path)
        src = src.rstrip('\n')

        html = html[:pos + h] + src + html[pos + body_end:]
        stats.append((name, len(src)))

    if check_only:
        print('模板 %d 字符，模块 %d 个' % (original_len, len(stats)))
        for n, L in reversed(stats):
            print('   %-18s %6d 字符' % (n, L))
        return

    with io.open(TARGET, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print('已重生 %s（%d → %d 字符）' % (os.path.relpath(TARGET, ROOT), original_len, len(html)))
    for n, L in reversed(stats):
        print('   %-18s %6d 字符' % (n, L))


if __name__ == '__main__':
    main()
