import { getDurationSeconds, record, validate, weekdays, type target } from "./util.ts";
import { exists } from "jsr:@std/fs/exists"

await ensureSingleProcess()

console.log("Loading task(s)...")

const tasks = JSON.parse(await Deno.readTextFile("tasks.json"))
validate(tasks)

const currentDay = weekdays[new Date().getDay()]
const dailyTasks: target[] = (tasks.targets as target[]).filter(it => it.start.weekday == currentDay)

let taskCount = 0
for (const task of dailyTasks) {
    const currentDate = new Date()
    const secondsInDay = currentDate.getSeconds() + currentDate.getMinutes() * 60 + currentDate.getHours() * 3600
    const taskExecuteSecond = getDurationSeconds(task.start.time)
    const taskDurationSeconds = getDurationSeconds(task.duration)
    if (taskExecuteSecond + taskDurationSeconds <= secondsInDay) continue
    const timeout = Math.max(0, taskExecuteSecond - secondsInDay) * 1000
    setTimeout(() => startTask(task), timeout)
    taskCount++
}
console.log(`Scheduled ${taskCount} task(s) for today`)

function startTask(task: target) {
    const currentDate = new Date()
    const secondsInDay = currentDate.getSeconds() + currentDate.getMinutes() * 60 + currentDate.getHours() * 3600
    const taskTotalDurationSeconds = getDurationSeconds(task.duration)
    const taskExecuteSecond = getDurationSeconds(task.start.time)
    const taskDurationSeconds = taskTotalDurationSeconds - Math.max(0, secondsInDay - taskExecuteSecond)
    if (taskDurationSeconds < 0) return
    record(
        tasks.sources[task.source],
        taskDurationSeconds,
        `${tasks.outDirectory}/${task.name}/${currentDate.getFullYear()}-${currentDate.getMonth()}-${currentDate.getDay()}_${task.start.time.replaceAll(":", "-")}.mp4`
    )
}

async function ensureSingleProcess() {
    if (Deno.build.os != "linux") return
    const processFilePath = ".process.pid"
    if (await exists(processFilePath)) {
        const oldPid = Number.parseInt(await Deno.readTextFile(processFilePath)).toString()
        const killResponse = await new Deno.Command("kill", { args: ["-0", oldPid] }).output()
        if (killResponse.code == 0) {
            const psResponse = await new Deno.Command("ps", { args: ["-p", oldPid] }).output()
            const processInfo = new TextDecoder().decode(psResponse.stdout)
            if (!processInfo.includes("deno")) return
            const timeout = setTimeout(() => {
                console.error("Did not answer in time. Aborting this process.")
                Deno.exit(1)
            }, 120 * 1000)
            const result = Deno.args.some(it => it == "--kill-old") ? "y" : prompt("A lecture recorder process is already active. Kill it and start this one? [Y/N]:")
            if (result?.toLowerCase() == "y") {
                clearTimeout(timeout)
                await new Deno.Command("kill", { args: [oldPid] }).output()
                console.log("Killed the old lecture recorder process.")
            } else {
                console.log("Aborting this process.")
                Deno.exit(0)
            }
        }
    }
    await Deno.writeTextFile(processFilePath, Deno.pid.toString())
}