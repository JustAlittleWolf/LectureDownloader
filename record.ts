import { record } from "./util.ts";

if (Deno.args.length != 3) {
    console.error("Incorrect usage. Please use:\n\tdeno run record.ts <source_url> <duration_seconds> <outfile_path>")
    Deno.exit(1)
}

await record(Deno.args[0], Number.parseInt(Deno.args[1]), Deno.args[2])