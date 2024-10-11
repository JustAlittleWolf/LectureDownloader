# Lecture Downloader

This is a server utility written in [deno](https://deno.com/) to download lectures streamed with the
hls protocol.

To configure this to your needs, modify the `tasks.json` file:

```json
EXAMPLE
{
    "sources": {
        "informatics room": "https://live.video.tuwien.ac.at/lt-live/deu116-informatikhoersaal/playlist.m3u8",
        "audimax": "https://live.video.tuwien.ac.at/lt-live/bau178a-gm-1-audi-max/playlist.m3u8"
    },
    "targets": [
        {
            "name": "my favorite lecture",
            "start": {
                "weekday": "thursday",
                "time": "18:00"
            },
            "source": "informatics room",
            "duration": "2:00"
        },
        {
            "name": "test",
            "start": {
                "weekday": "monday",
                "time": "12:30"
            },
            "source": "audimax",
            "duration": "1:30"
        }
    ],
    "outDirectory": "C:/some/directory"
}
```

To validate the `tasks.json` file, run `deno run --allow-read validate.ts`

To run the downloader set up a cron job to run
`deno run --allow-read --allow-write --allow-net --allow-run main.ts` once a
day, before the first lecture starts

```cron
EXAMPLE cron job
runs every day at 6:55 AM and saves the output in out.log
55 6 * * * cd "PATH-TO-LectureDownloader" && PATH-TO-DENO-EXECUTABLE run --allow-read --allow-write --allow-net --allow-run main.ts --kill-old >> out.log 2>&1 &
```

To run the downloader manually in the background on linux, you can use the
`start.sh` script

To automatically kill old tasks, run the script with the `--kill-old` argument

To run the downloader manuylly on windows, you can use the `start.bat` script,
although closing the terminal window, will terminate the program

On Windows: **RUNNING THE `main.ts` PROGRAM MULTIPLE TIMES PER DAY WILL BREAK
THINGS**

To record a single stream, run
`deno run --allow-read --allow-write --allow-net record.ts <link-to-m3u8-playlist> <recording duration in seconds> <out file>`
