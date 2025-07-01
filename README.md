# express-libp2p

##### Install dependencies and copy env file
```bash
pnpm install
cp .env.example .env
```
## Services
- p2p local node
- p2p boostrap nodes network

### p2p local node：

##### dev
```bash
pnpm dev
```

##### compile
```bash
pnpm build
```

##### production
```bash
pnpm start
```

##### package（需要esbulid or bun，目前是用esbuild打包）
```
pnpm build:bundle
```


##### run
```bash
bun dist/libp2p.bundle.js
```
or:

```
node dist/libp2p.bundle.js
```

### p2p boostrap nodes network

#### start
```
pnpm run start:bootstrap
```

#### compile
```
pnpm run build:bootstrap
```