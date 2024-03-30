import { Body, Client, ResponseType, getClient } from '@tauri-apps/api/http';
import { Child, Command } from '@tauri-apps/api/shell';

export const WS_PORT = 50001;
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
    address?: string; // private

    Hostname?: string;
    CPU?: string;
    RAM?: string;
    BIOS?: string;
    PublicIP?: string;
    PrivateIP?: string;
    MacAddr?: string;

    GPUs: string[];
    Sessions?: StartRequest[];
    Volumes?: string[];
};

export async function GetInfo(ip: string): Promise<Computer | Error> {
    return await internalFetch<Computer>(ip, 'info');
}

export type StartRequest = {
    id: string;
    target?: string;

    turn?: {
        minPort: number;
        maxPort: number;
        port: number;
        username: string;
        password: string;
    };
    sunshine?: {
        username: string;
        password: string;
        port: string;
    };
    thinkmay?: {
        stunAddress: string;
        turnAddress: string;
        username: string;
        password: string;
        audioToken?: string;
        videoToken?: string;
    };
    display?: {
        ScreenWidth: number;
        ScreenHeight: number;
    };
    vm?: Computer;
};

export async function StartVirtdaemon(
    computer: Computer,
    volume_id?: string
): Promise<any> {
    const { address } = computer;

    const id = crypto.randomUUID();
    const req: StartRequest = {
        id,
        vm: {
            GPUs: ['GA104 [GeForce RTX 3060 Ti Lite Hash Rate]'],
            Volumes: volume_id != undefined ? [volume_id] : [],
            CPU: '16',
            RAM: '16'
        }
    };

    const resp = await internalFetch(address, 'new', req);
    if (resp instanceof Error) return resp;

    return;
}

export type Session = {
    audioUrl: string;
    videoUrl: string;
    rtc_config: RTCConfiguration;
};

export async function StartThinkmayOnVM(
    computer: Computer,
    target: string
): Promise<Session> {
    const { address } = computer;

    const turn = {
        minPort: WS_PORT,
        maxPort: 65535,
        port: getRandomInt(WS_PORT, 65535),
        username: crypto.randomUUID(),
        password: crypto.randomUUID()
    };

    const thinkmay = {
        stunAddress: `stun:${address}:${turn.port}`,
        turnAddress: `turn:${address}:${turn.port}`,
        username: turn.username,
        password: turn.password
    };

    const display = {
        ScreenWidth: 1920,
        ScreenHeight: 1080
    };

    const id = crypto.randomUUID();
    const req: StartRequest = {
        id,
        target,
        thinkmay,
        turn,
        display
    };

    const resp = await internalFetch<StartRequest>(address, 'new', req);
    if (resp instanceof Error) throw resp;

    return {
        audioUrl:
            client == null
                ? `https://${address}/handshake/client?token=${resp.thinkmay.audioToken}&target=${target}`
                : `http://${address}:${WS_PORT}/handshake/client?token=${resp.thinkmay.audioToken}&target=${target}`,
        videoUrl:
            client == null
                ? `https://${address}/handshake/client?token=${resp.thinkmay.videoToken}&target=${target}`
                : `http://${address}:${WS_PORT}/handshake/client?token=${resp.thinkmay.videoToken}&target=${target}`,
        rtc_config: {
            iceTransportPolicy: 'relay',
            iceServers: [
                {
                    urls: `stun:${address}:${turn.port}`
                },
                {
                    urls: `turn:${address}:${turn.port}`,
                    username: turn.username,
                    credential: turn.password
                }
            ]
        }
    };
}
export async function StartThinkmay(computer: Computer): Promise<Session> {
    const { address } = computer;

    const turn = {
        minPort: WS_PORT,
        maxPort: 65535,
        port: getRandomInt(WS_PORT, 65535),
        username: crypto.randomUUID(),
        password: crypto.randomUUID()
    };

    const thinkmay = {
        stunAddress: `stun:${address}:${turn.port}`,
        turnAddress: `turn:${address}:${turn.port}`,
        username: turn.username,
        password: turn.password
    };

    const display = {
        ScreenWidth: 1920,
        ScreenHeight: 1080
    };

    const id = crypto.randomUUID();
    const req: StartRequest = {
        id,
        thinkmay,
        turn,
        display
    };

    const resp = await internalFetch<StartRequest>(address, 'new', req);
    if (resp instanceof Error) throw resp;

    return {
        audioUrl:
            client == null
                ? `https://${address}/handshake/client?token=${resp.thinkmay.audioToken}`
                : `http://${address}:${WS_PORT}/handshake/client?token=${resp.thinkmay.audioToken}`,
        videoUrl:
            client == null
                ? `https://${address}/handshake/client?token=${resp.thinkmay.videoToken}`
                : `http://${address}:${WS_PORT}/handshake/client?token=${resp.thinkmay.videoToken}`,
        rtc_config: {
            iceTransportPolicy: 'all',
            iceServers: [
                {
                    urls: `stun:${address}:${turn.port}`
                },
                {
                    urls: `turn:${address}:${turn.port}`,
                    username: turn.username,
                    credential: turn.password
                }
            ]
        }
    };
}
export function ParseRequest(
    computer: Computer,
    session: StartRequest
): Session {
    const { address } = computer;
    const { turn, thinkmay } = session;

    return {
        audioUrl:
            client == null
                ? `https://${address}/handshake/client?token=${thinkmay.audioToken}`
                : `http://${address}:${WS_PORT}/handshake/client?token=${thinkmay.audioToken}`,
        videoUrl:
            client == null
                ? `https://${address}/handshake/client?token=${thinkmay.videoToken}`
                : `http://${address}:${WS_PORT}/handshake/client?token=${thinkmay.videoToken}`,
        rtc_config: {
            iceTransportPolicy: 'all',
            iceServers: [
                {
                    urls: `stun:${address}:${turn.port}`
                },
                {
                    urls: `turn:${address}:${turn.port}`,
                    username: turn.username,
                    credential: turn.password
                }
            ]
        }
    };
}

export function ParseVMRequest(
    computer: Computer,
    session: StartRequest
): Session {
    const { address } = computer;
    const { turn, thinkmay, target } = session;

    return {
        audioUrl:
            client == null
                ? `https://${address}/handshake/client?token=${thinkmay.audioToken}&target=${target}`
                : `http://${address}:${WS_PORT}/handshake/client?token=${thinkmay.audioToken}&target=${target}`,
        videoUrl:
            client == null
                ? `https://${address}/handshake/client?token=${thinkmay.videoToken}&target=${target}`
                : `http://${address}:${WS_PORT}/handshake/client?token=${thinkmay.videoToken}&target=${target}`,
        rtc_config: {
            iceTransportPolicy: 'relay', // preferred as VM often under double NAT
            iceServers: [
                {
                    urls: `stun:${address}:${turn.port}`
                },
                {
                    urls: `turn:${address}:${turn.port}`,
                    username: turn.username,
                    credential: turn.password
                }
            ]
        }
    };
}

type MoonlightStreamConfig = {
    bitrate?: number;
    width?: number;
    height?: number;
};
type MoonlightStream = {
    process: Child
    request: StartRequest
    computer: Computer
}
export async function StartMoonlight(
    computer: Computer,
    options?: MoonlightStreamConfig,
    callback?: (type: 'stdout' | 'stderr', log: string) => void
): Promise<MoonlightStream> {
    const { address } = computer;

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
    console.log(`starting moonlight with ${cmds}`);
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
        computer
    }
}

export async function CloseMoonlight(stream: MoonlightStream): Promise<Error | 'SUCCESS'> {
    stream.process.kill()
    const resp = await internalFetch(stream.computer.address, 'closed', stream.request);
    return resp instanceof Error ? resp : 'SUCCESS';
}

export async function CloseSession(
    computer: Computer,
    req: StartRequest
): Promise<Error | 'SUCCESS'> {
    const resp = await internalFetch(computer.address, 'closed', req);
    return resp instanceof Error ? resp : 'SUCCESS';
}

function getRandomInt(min: number, max: number) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}
async function JoinZeroTier(network_id: string): Promise<string> {
    const command = await new Command('ZeroTier', [
        'leave',
        network_id
    ]).execute();
    return command.stdout + '\n' + command.stderr;
}
async function LeaveZeroTier(network_id: string): Promise<string> {
    const command = await new Command('ZeroTier', [
        'join',
        network_id
    ]).execute();
    return command.stdout + '\n' + command.stderr;
}
async function DiscordRichPresence(app_id: string): Promise<string> {
    const command = await new Command('Daemon', ['discord', app_id]).execute();
    return command.stdout + '\n' + command.stderr;
}
