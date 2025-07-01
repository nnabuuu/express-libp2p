import fs from "fs";
import * as fsAsync from "fs/promises";
import os from "os";
import path from "path";
import nacl from "tweetnacl";

/**
 * 获取配置存储目录
 */
export function getDataDir(): string {
    return process.env["SIGHTAI_DATA_DIR"]
        ? path.join(process.env["SIGHTAI_DATA_DIR"], "config")
        : path.join(os.homedir(), ".sightai", "config");
}

/**
 * 从本地文件读取或生成新的密钥对
 */
export async function loadOrGenerateKeyPair(): Promise<nacl.SignKeyPair> {
    const dataDir = getDataDir();
    const keypairPath = path.join(dataDir, "device-keypair.json");

    if (fs.existsSync(keypairPath)) {
        const kpStr = await fsAsync.readFile(keypairPath, "utf-8");
        const kpObj = JSON.parse(kpStr);
        kpObj.lastUsed = new Date().toISOString();
        await fsAsync.writeFile(keypairPath, JSON.stringify(kpObj, null, 2), "utf-8");
        console.log(`[KeyPair] Loaded from ${keypairPath}`);
        return nacl.sign.keyPair.fromSeed(Uint8Array.from(kpObj.seed));
    } else {
        const seed = nacl.randomBytes(32);
        const kpObj = {
            seed: Array.from(seed),
            createdAt: new Date().toISOString(),
            lastUsed: new Date().toISOString(),
        };
        await fsAsync.mkdir(dataDir, { recursive: true });
        await fsAsync.writeFile(keypairPath, JSON.stringify(kpObj, null, 2), "utf-8");
        console.log(`[KeyPair] Generated new and saved to ${keypairPath}`);
        return nacl.sign.keyPair.fromSeed(seed);
    }
}

/**
 * 解析 bootstrap 节点列表字符串
 */
export function parseBootstrapList(raw: string): string[] {
    return raw
        .split(",")
        .map((addr) => addr.trim())
        .filter(Boolean);
}
