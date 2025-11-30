import React, { useEffect, useState, useRef } from "react";

export default function PythonStudio() {
  const [pyodideLoading, setPyodideLoading] = useState(true);
  const [pyodide, setPyodide] = useState(null);
  const [files, setFiles] = useState(() => {
    try {
      const raw = localStorage.getItem("python-studio-files-v1");
      return raw ? JSON.parse(raw) : defaultFiles();
    } catch {
      return defaultFiles();
    }
  });
  const [selected, setSelected] = useState(0);
  const [output, setOutput] = useState("");
  const [errOutput, setErrOutput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [themeDark, setThemeDark] = useState(() => localStorage.getItem("python-studio-theme") === "dark");
  const [installPkg, setInstallPkg] = useState("");
  const outputRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("python-studio-files-v1", JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    localStorage.setItem("python-studio-theme", themeDark ? "dark" : "light");
  }, [themeDark]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPyodideLoading(true);
      try {
        if (!window.loadPyodide) {
          const s = document.createElement("script");
          s.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js";
          s.async = true;
          document.head.appendChild(s);
          await new Promise((res) => (s.onload = res));
        }
        const py = await window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/" });
        if (cancelled) return;
        setPyodide(py);
      } catch (e) {
        setOutput((o) => o + "\n[خطا در بارگذاری Pyodide] " + e);
      } finally {
        if (!cancelled) setPyodideLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight; }, [output, errOutput]);

  function defaultFiles() {
    return [
      {
        name: "main.py",
        content: `# Hello\nprint(\"Hello, Python Studio!\")\n\n# sample function\ndef fib(n):\n    if n < 2:\n        return n\n    return fib(n-1) + fib(n-2)\n\nprint('fib(10)=', fib(10))`,
      },
      {
        name: "example_loop.py",
        content: `# simple loop\nfor i in range(5):\n    print('line', i)`,
      },
    ];
  }

  function updateCurrentFile(changes) {
    setFiles((f) => {
      const copy = [...f];
      copy[selected] = { ...copy[selected], ...changes };
      return copy;
    });
  }

  function newFile() {
    const name = prompt("نام فایل جدید:", "untitled.py");
    if (!name) return;
    setFiles((f) => [...f, { name, content: "# new file\n" }]);
    setSelected(files.length);
  }

  function deleteFile(idx) {
    if (!confirm("آیا مطمئنی می‌خواهی این فایل را حذف کنی؟")) return;
    setFiles((f) => {
      const copy = [...f];
      copy.splice(idx, 1);
      return copy.length ? copy : defaultFiles();
    });
    setSelected(0);
  }

  async function runCode() {
    if (!pyodide) {
      alert("Pyodide هنوز بارگذاری نشده است...");
      return;
    }
    setIsRunning(true);
    setOutput((o) => o + "\n--- اجرای کد ---\n");
    setErrOutput("");
    try {
      const code = files[selected]?.content || "";
      const wrapped = `
import sys, io
buf_out = io.StringIO()
buf_err = io.StringIO()
old_out, old_err = sys.stdout, sys.stderr
sys.stdout, sys.stderr = buf_out, buf_err
try:
    exec(${JSON.stringify(code)}, globals())
finally:
    sys.stdout, sys.stderr = old_out, old_err
(out:=buf_out.getvalue(), err:=buf_err.getvalue())
`;
      const res = await pyodide.runPythonAsync(wrapped);
      const jsRes = res.toJs ? res.toJs() : res;
      const out = jsRes[0] ?? "";
      const err = jsRes[1] ?? "";
      if (out) setOutput((o) => o + out);
      if (err) setErrOutput((e) => e + err);
    } catch (e) {
      setErrOutput((er) => er + "\n" + String(e));
    } finally {
      setIsRunning(false);
    }
  }

  async function installPackage() {
    if (!pyodide) return alert("Pyodide آماده نیست");
    if (!installPkg) return;
    setOutput((o) => o + `\n[در حال نصب بسته: ${installPkg} ...]\n`);
    try {
      await pyodide.runPythonAsync(`import micropip\nawait micropip.install(${JSON.stringify(installPkg)})`);
      setOutput((o) => o + `[نصب ${installPkg} با موفقیت انجام شد]\n`);
    } catch (e) {
      setErrOutput((er) => er + `\n[خطا در نصب ${installPkg}: ]` + e);
    }
    setInstallPkg("");
  }

  function resetPyodide() {
    if (!confirm("این کار محیط پایتون را دوباره راه‌اندازی می‌کند. ادامه می‌دهی؟")) return;
    setPyodideLoading(true);
    setPyodide(null);
    setOutput((o) => o + "\n[در حال ریست Pyodide...]\n");
    const old = document.querySelector('script[src*="pyodide"]');
    if (old) old.remove();
    (async () => {
      try {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js";
        s.async = true;
        document.head.appendChild(s);
        await new Promise((res) => (s.onload = res));
        const py = await window.loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.24.1/full/" });
        setPyodide(py);
        setOutput((o) => o + "[Pyodide ریست شد]\n");
      } catch (e) {
        setErrOutput((er) => er + "\n" + e);
      } finally {
        setPyodideLoading(false);
      }
    })();
  }

  function importExample(idx) {
    const ex = examples()[idx];
    setFiles((f) => [...f, { name: ex.name, content: ex.content }]);
    setSelected(files.length);
  }

  function examples() {
    return [
      {
        name: "hello_async.py",
        content: `import asyncio\n\nasync def main():\n    print('شروع')\n    await asyncio.sleep(1)\n    print('تمام')\n\nasyncio.run(main())`,
      },
      {
        name: "calc_primes.py",
        content: `def primes(n):\n    res=[]\n    for i in range(2,n):\n        for p in range(2,int(i**0.5)+1):\n            if i%p==0:\n                break\n        else:\n            res.append(i)\n    return res\n\nprint(primes(50))`,
      },
    ];
  }

  return (
    <div className={themeDark ? "dark" : ""}>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-12 gap-4">
          <aside className="col-span-3 bg-white/5 rounded-2xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">فایل‌ها</h2>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded bg-blue-600 text-white text-sm" onClick={newFile}>+ فایل</button>
                <button className="px-3 py-1 rounded bg-green-600 text-white text-sm" onClick={() => importExample(0)}>نمونه</button>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {files.map((f, i) => (
                <div key={i} className={`p-2 rounded hover:bg-white/5 flex items-center justify-between ${i === selected ? "bg-white/5" : ""}`}>
                  <div onClick={() => setSelected(i)} className="cursor-pointer flex-1">
                    <div className="font-mono text-sm truncate">{f.name}</div>
                    <div className="text-xs text-gray-400 truncate">{(f.content || "").split('\n')[0]}</div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button title="حذف" className="px-2 py-1 rounded bg-red-600 text-white text-xs" onClick={() => deleteFile(i)}>حذف</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 text-xs text-gray-400">Pyodide: {pyodideLoading ? "در حال بارگذاری..." : "آماده"}</div>

            <div className="mt-2 flex gap-2">
              <button className="flex-1 px-3 py-2 rounded bg-indigo-600 text-white" onClick={runCode} disabled={isRunning || pyodideLoading}>{isRunning ? 'در حال اجرا...' : '▶️ اجرا'}</button>
              <button className="px-3 py-2 rounded bg-yellow-600 text-white" onClick={() => { setOutput(''); setErrOutput(''); }}>پاک کن</button>
            </div>

            <div className="mt-2">
              <label className="text-sm">نصب بسته (pip):</label>
              <div className="flex gap-2 mt-1">
                <input value={installPkg} onChange={(e) => setInstallPkg(e.target.value)} className="flex-1 bg-transparent border rounded px-2 py-1 text-sm" placeholder="مثال: rich" />
                <button className="px-3 py-1 rounded bg-sky-600 text-white text-sm" onClick={installPackage}>نصب</button>
              </div>
              <div className="text-xs text-gray-400 mt-1">برای نصب بسته‌ها از <code>micropip</code> استفاده می‌شود. برخی بسته‌ها ممکن است سنگین باشند.</div>
            </div>

            <div className="mt-3 flex gap-2">
              <button className="flex-1 px-2 py-1 rounded bg-stone-600 text-white text-sm" onClick={resetPyodide}>ریست Pyodide</button>
              <button className="px-2 py-1 rounded bg-gray-700 text-white text-sm" onClick={() => setThemeDark(!themeDark)}>{themeDark ? 'روشن' : 'تاریک'}</button>
            </div>

          </aside>

          <main className="col-span-6 bg-white/3 rounded-2xl p-4 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold">ویرایشگر — {files[selected]?.name}</h3>
                <small className="text-xs text-gray-400">(ذخیره خودکار)</small>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded bg-emerald-600 text-white text-sm" onClick={() => { navigator.clipboard?.writeText(files[selected]?.content || ""); alert('کد کپی شد'); }}>کپی کد</button>
                <button className="px-3 py-1 rounded bg-violet-600 text-white text-sm" onClick={() => { const blob = new Blob([files[selected]?.content || ""], { type: 'text/plain' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = files[selected]?.name || 'code.py'; a.click(); URL.revokeObjectURL(url); }}>دانلود</button>
              </div>
            </div>

            <textarea
              value={files[selected]?.content}
              onChange={(e) => updateCurrentFile({ content: e.target.value })}
              className="flex-1 bg-transparent border rounded p-3 font-mono text-sm w-full resize-none"
            />

            <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
              <div>تغییرات ذخیره می‌شود در localStorage</div>
              <div>خط: { (files[selected]?.content || "").split('\n').length }</div>
            </div>
          </main>

          <section className="col-span-3 bg-white/5 rounded-2xl p-3 flex flex-col">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">خروجی / کنسول</h4>
              <div className="text-xs text-gray-400">خطاها با رنگ جدا نمایش داده می‌شوند</div>
            </div>

            <div ref={outputRef} className="mt-2 flex-1 overflow-auto p-3 bg-black/60 rounded font-mono text-sm">
              <pre className="whitespace-pre-wrap text-white">{output}</pre>
              {errOutput ? <pre className="whitespace-pre-wrap text-red-400 mt-2">{errOutput}</pre> : null}
            </div>

            <div className="mt-3 text-xs text-gray-400">نکته: برای خاتمه دادن به برنامه‌های بی‌نهایت از دکمه ریست Pyodide استفاده کن.</div>
          </section>

        </div>
      </div>
    </div>
  );
}
