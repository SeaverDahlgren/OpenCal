const apiBaseUrl = process.env.OPENCAL_API_BASE_URL ?? "http://127.0.0.1:8787/api/v1";
const adminKey = process.env.ADMIN_API_KEY;

async function main() {
  if (!adminKey) {
    throw new Error("ADMIN_API_KEY is required.");
  }

  const [command, email, ...nameParts] = process.argv.slice(2);
  switch (command) {
    case "list": {
      const data = await request("/admin/beta-user");
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    case "add": {
      if (!email) {
        throw new Error("Usage: npm run beta:users -- add <email> [name]");
      }
      const name = nameParts.join(" ").trim() || undefined;
      const data = await request("/admin/beta-user", {
        method: "POST",
        body: JSON.stringify({ email, name }),
      });
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    case "remove": {
      if (!email) {
        throw new Error("Usage: npm run beta:users -- remove <email>");
      }
      const data = await request(`/admin/beta-user?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
      });
      console.log(JSON.stringify(data, null, 2));
      return;
    }
    default:
      throw new Error("Usage: npm run beta:users -- <list|add|remove> ...");
  }
}

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-admin-key": adminKey!,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Request failed with ${response.status}`);
  }
  return payload;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
