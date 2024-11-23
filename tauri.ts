import { Body, Client, ResponseType, getClient } from '@tauri-apps/api/http';
import { Child, Command } from '@tauri-apps/api/shell';

export const WS_PORT = 60000;
let client: Client = null;
getClient().then((x) => (client = x));
async function internalFetch<T>(
    address: string,
    command: string,
    body?: any
): Promise<T | Error> {
    if (client != null) {
        if (command == 'info') {
            const { data, ok } = await client.get<T>(
                `http://${address}:${WS_PORT}/info`,
                {
                    timeout: { secs: 3, nanos: 0 },
                    responseType: ResponseType.JSON
                }
            );

            if (!ok) return new Error('fail to request');

            return data;
        } else {
            const { data, ok } = await client.post<T>(
                `http://${address}:${WS_PORT}/${command}`,
                Body.json(body),
                {
                    responseType: ResponseType.JSON
                }
            );

            if (!ok) return new Error('fail to request');

            return data;
        }
    } else {
        if (command == 'info') {
            const resp = await fetch(`https://${address}/info`);

            if (!resp.ok) return new Error('fail to request');

            return await resp.json();
        } else {
            const resp = await fetch(`https://${address}/${command}`, {
                method: 'POST',
                body: JSON.stringify(body)
            });

            if (!resp.ok) return new Error('fail to request');

            return await resp.json();
        }
    }
}

export type Computer = {
    address: string; // private
    zerotierid?: string;
};


export type StartRequest = {
    id: string;
    sunshine: {
        username: string;
        password: string;
        port: string;
    };
};


type MoonlightStreamConfig = {
    bitrate?: number;
    width?: number;
    height?: number;
};
type MoonlightStream = {
    process: Child
    request: StartRequest
    computer: Computer

    zerotierid?: string;
}
export async function StartMoonlight(
    computer: Computer,
    options?: MoonlightStreamConfig,
    callback?: (type: 'stdout' | 'stderr', log: string) => void
): Promise<MoonlightStream> {
    const { address,zerotierid } = computer;

    if (zerotierid != undefined) {
        const res = await JoinZeroTier(zerotierid)
        if(!res.includes('200'))
            throw new Error(`failed to join zerotier ${res}`)
        else
            await new Promise(r => setTimeout(r,10000))
    }

    const PORT = getRandomInt(60000, 65530);
    const sunshine = {
        username: getRandomInt(0, 9999).toString(),
        password: getRandomInt(0, 9999).toString(),
        port: PORT.toString()
    };


    const id = crypto.randomUUID();
    const req = {
        id,
        timestamp: new Date().toISOString(),
        sunshine
    };

    const resp = await internalFetch<StartRequest>(address, 'new', req);
    if (resp instanceof Error) throw resp;

    const { username, password } = sunshine;
    const cmds = [
        '--address',
        address,
        '--port',
        `${PORT}`,
        '--width',
        `${options?.width ?? 1920}`,
        '--height',
        `${options?.height ?? 1080}`,
        '--bitrate',
        `${options?.bitrate ?? 6000}`,
        '--username',
        username,
        '--password',
        password
    ];
    const command = new Command('Moonlight', cmds);
    command.stderr.addListener('data', (data) =>
        callback != undefined ? callback('stderr', data) : console.log(data)
    );
    command.stdout.addListener('data', (data) =>
        callback != undefined ? callback('stdout', data) : console.log(data)
    );

    return {
        process: await command.spawn(),
        request: resp,
        computer,
        zerotierid
    }
}

export async function CloseMoonlight(stream: MoonlightStream): Promise<Error | 'SUCCESS'> {
    stream.process.kill()
    const resp = await internalFetch(stream.computer.address, 'closed', stream.request);
    if (stream.zerotierid != undefined) {
        const result = await LeaveZeroTier(stream.zerotierid)
        if(!result.includes('200'))
            throw new Error(`failed to join zerotier ${result}`)
    }

    return resp instanceof Error ? resp : 'SUCCESS';
}


function getRandomInt(min: number, max: number) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}
async function LeaveZeroTier(network_id: string): Promise<string> {
    const command = await new Command('ZeroTier', [
        '-q',
        '-TIO2MV3Dxac8xpQVS5b14tw3gjA7SciCg',
        'leave',
        network_id
    ]).execute();
    return command.stdout + '\n' + command.stderr;
}
async function JoinZeroTier(network_id: string): Promise<string> {
    const command = await new Command('ZeroTier', [
        '-q',
        '-TIO2MV3Dxac8xpQVS5b14tw3gjA7SciCg',
        'join',
        network_id
    ]).execute();
    return command.stdout + '\n' + command.stderr;
}

let discordchild = null
export async function DiscordRichPresence(app_id: string, title : string, detail : string): Promise<string> {
    const command = new Command('Daemon', ['discord', app_id, btoa(`${title}|${detail}`)]);
    discordchild = await command.spawn()
    return 'SUCCESS'
}
