const express = require("express");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs/promises");
const app = express();

app.use(express.json({ limit: "5mb" }));

async function downloadToFile(url, outPath) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Falha ao baixar URL: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buf);
}

// Vamos usar diretamente o 'convert' que é o comando padrão do ImageMagick 6 no Linux
function runMagick(args) {
  return new Promise((resolve, reject) => {
    execFile("convert", args, { maxBuffer: 50 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve({ stdout, stderr });
    });
  });
}

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/render", async (req, res) => {
  try {
    const { backgroundUrl, productUrl, outWidth = 1080, outHeight = 1350 } = req.body || {};
    if (!backgroundUrl || !productUrl) return res.status(400).json({ error: "Faltam links!" });

    const tmpDir = "/tmp/render";
    await fs.mkdir(tmpDir, { recursive: true });

    const id = Date.now();
    const bgPath = path.join(tmpDir, `bg_${id}.png`);
    const productPath = path.join(tmpDir, `prod_${id}.png`);
    const outPath = path.join(tmpDir, `out_${id}.png`);

    await downloadToFile(backgroundUrl, bgPath);
    await downloadToFile(productUrl, productPath);

    const args = [
      bgPath, "-resize", `${outWidth}x${outHeight}^`, "-gravity", "center", "-extent", `${outWidth}x${outHeight}`,
      "(", productPath, "-resize", "760x760", ")", "-gravity", "center", "-geometry", "+0+80", "-composite",
      "-strip", outPath
    ];

    await runMagick(args);
    const outBuf = await fs.readFile(outPath);
    
    res.setHeader("Content-Type", "image/png");
    res.send(outBuf);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Rodando na porta ${port}`));
