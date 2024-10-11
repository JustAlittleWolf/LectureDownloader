import { validate } from "./util.ts";

const tasks = JSON.parse(await Deno.readTextFile("tasks.json"))
validate(tasks)
console.log("tasks.json is valid")