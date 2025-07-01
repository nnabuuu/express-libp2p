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
## Go Implementation
The `go-project` directory contains a standalone Go version of the server. Due to sandbox restrictions it relies on an in-memory pub/sub implementation instead of `go-libp2p`. The service exposes `/libp2p/send` for publishing messages.

Build the Go project:
```bash
cd go-project
go build
```

Run the server with:
```bash
./go-project
```

To build a standalone executable with a custom name run:
```bash
cd go-project
go build -o libp2p-server
```
This produces a `libp2p-server` binary in the `go-project` directory that can be
copied and executed on the same platform. Use standard Go `GOOS` and `GOARCH`
environment variables if you need to cross-compile for another OS or CPU
architecture.

