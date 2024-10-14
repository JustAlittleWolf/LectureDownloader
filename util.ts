import { copy } from "jsr:@std/io/copy"
import { readerFromStreamReader } from "jsr:@std/io/reader-from-stream-reader"
import { ensureDir } from "jsr:@std/fs/ensure-dir"

export const weekdays: weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]

export type weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
export type tasks = {
    sources: string[],
    targets: target[],
    outDirectory: string
}
export type target = {
    name: string,
    start: start,
    source: string,
    duration: string
}
export type start = {
    weekday: weekday,
    time: string
}


export function validate(tasks: tasks) {
    if (typeof tasks != "object") throwMalformedJsonError("tasks.json should be a json object")
    if (!tasks.sources) throwMalformedJsonError(`missing a "sources" field`)
    if (typeof tasks.sources != "object") throwMalformedJsonError("sources must be an object")
    const sources = new Set<string>()
    for (const source in tasks.sources) {
        sources.add(source)
        try {
            new URL(tasks.sources[source])
        } catch (_) {
            throwMalformedJsonError(`url for sources.${source} is not valid: ${tasks.sources[source]}`)
        }
    }
    if (!tasks.targets) throwMalformedJsonError(`missing a "targets" field`)
    if (!Array.isArray(tasks.targets)) throwMalformedJsonError("targets must be an array")
    const weekdaySet = new Set(weekdays)
    for (const target of tasks.targets) {
        if (typeof target != "object") throwMalformedJsonError(`target must be an object`, target)
        if (!target.name || typeof target.name != "string") throwMalformedJsonError(`target must have a string "name" field`, target)
        if (!target.source || typeof target.source != "string") throwMalformedJsonError(`target must have a string "source" field`, target)
        if (!sources.has(target.source)) throwMalformedJsonError(`target does not have a valid source`, target)
        if (!target.duration || typeof target.duration != "string") throwMalformedJsonError(`target must have a string "duration" field`, target)
        try {
            getDurationSeconds(target.duration)
        } catch (_) {
            throwMalformedJsonError(`target.duration formatted incorrectly, should be HH:MM`, target)
        }
        if (!target.start || typeof target.start != "object") throwMalformedJsonError(`target must have an object "start" field`, target)
        if (!target.start.weekday || typeof target.start.weekday != "string") throwMalformedJsonError(`target.start must have a string "weekday" field`, target)
        if (!weekdaySet.has(target.start.weekday)) throwMalformedJsonError(`target.start.weekday has to be one of ${Array.from(weekdaySet).join(", ")}`, target)
        if (!target.start.time || typeof target.start.time != "string") throwMalformedJsonError(`target.start must have a string "time" field`, target)
        try {
            getDurationSeconds(target.start.time)
        } catch (_) {
            throwMalformedJsonError(`target.start.time formatted incorrectly, should be HH:MM`, target)
        }
    }
    if (!tasks.outDirectory || typeof tasks.outDirectory != "string") throwMalformedJsonError(`missing a string "outDirectory" field`)
}

export function getDurationSeconds(duration: string): number {
    const values = duration.split(":")
    if (values.length != 2 || values[0].length > 2 || values[1].length != 2) throw Error("Duration Format Error")
    return Number.parseInt(values[0]) * 3600 + Number.parseInt(values[1]) * 60
}

function throwMalformedJsonError(reason: string, target: target | null = null) {
    console.error(`ERROR\nMalformed json in tasks.json: ${reason}${(target != null) ? ", at\n" + JSON.stringify(target) : ""}`)
    Deno.exit(1)
}

export async function record(videoURL: string, durationSeconds: number, saveFilePath: string) {
    const playlist = await fetch(videoURL).then(it => it.text())
    const chunklistURL = playlist.replaceAll("\r", "").split("\n").filter(it => !it.startsWith("#") && it.length != 0)[0]

    const chunkCache: Set<string> = new Set()
    const chunkAge: Map<string, number> = new Map()
    const chunkCacheSeconds = 60

    const chunkDownloadURL = chunklistURL.substring(0, chunklistURL.lastIndexOf('/') + 1)

    await ensureDir(saveFilePath.substring(0, saveFilePath.lastIndexOf("/")))
    const saveFile = await Deno.open(saveFilePath, { create: true, append: true })

    console.log(`\n${new Date().toLocaleString()} Starting recording task\nSource: \t${videoURL}\nDuration: \t${durationSeconds}s\nOutfile: \t${saveFilePath}`)

    downloadChunks()
    const downloadTask = setInterval(downloadChunks, 5000)

    setTimeout(() => {
        clearInterval(downloadTask)
        saveFile.close()
        console.log(`\n${new Date().toLocaleString()} Completed recording task\nView in ${saveFilePath}`)
    }, durationSeconds * 1000)

    function downloadChunks() {
        try {
            fetch(chunklistURL).then(it => it.text()).then(chunklist => {
                try {
                    const currentSeconds = Math.floor(Date.now() / 1_000)

                    for (const chunk of chunkCache) {
                        const chunkAgeSeconds = currentSeconds - (chunkAge.get(chunk) || chunkCacheSeconds * 10)
                        if (chunkAgeSeconds < chunkCacheSeconds) continue
                        chunkCache.delete(chunk)
                        chunkAge.delete(chunk)
                    }

                    const chunks = chunklist.replaceAll("\r", "").split("\n").filter(it =>
                        !it.startsWith("#") &&
                        it.length != 0 &&
                        it.endsWith(".ts") &&
                        !chunkCache.has(it)
                    )

                    for (const chunk of chunks) {
                        chunkCache.add(chunk)
                        chunkAge.set(chunk, currentSeconds)
                    }

                    writeChunks(chunks)
                } catch (e) { console.error("Error while downloading chunks: " + e) }
            })
        } catch (e) { console.error("Error while downloading chunks: " + e) }
    }

    async function writeChunks(chunks: string[]) {
        for (const chunk of chunks) {
            try {
                await writeChunk(chunk)
            } catch (e) { console.error("Error while writing chunk: " + e) }
        }
        saveFile.syncData()
    }

    async function writeChunk(chunk: string) {
        const response = await fetch(chunkDownloadURL + chunk)
        const streamReader = response.body?.getReader()
        if (streamReader) {
            const reader = readerFromStreamReader(streamReader)
            await copy(reader, saveFile)
        } else {
            console.error(`Error writing chunk ${chunk} for recording ${saveFilePath}: streamReader is null`)
        }
    }
}