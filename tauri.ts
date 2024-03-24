import { Body, Client, ResponseType, getClient } from '@tauri-apps/api/http';
import { Child, Command } from "@tauri-apps/api/shell";



let client : Client = null;
getClient().then(x => client = x);
export const WS_PORT = 60000

const map = new Map<string, {
    child?: Child,
    req: StartRequest
}>()

export function GetRequest(uuid: string): StartRequest {
    return map.get(uuid).req
}


type StartRequest = {
    sunshine?: {
        username: string,
        password: string,
        port: string
    }
    thinkmay?: {
        webrtcConfig: string
    }
    display?: {
        ScreenWidth: number,
        ScreenHeight: number,
    }

    target?: any
    computer: Computer
    id: number,
}

type StreamConfig = {
    bitrate?: number
    width?: number
    height?: number
}

type Computer = {
    address: string,
}

export async function StartVirtdaemon(computer: Computer, target: any): Promise<any> {
    const { address } = computer

    const id = crypto.randomUUID()
    const req = {
        id,
        target,
        vm: {
            GPU: 'GA104 [GeForce RTX 3060 Ti Lite Hash Rate]',
            CPU : "8",
            RAM : "8"
        }
    }

    const resp = await client.post(`http://${address}:${WS_PORT}/new`, Body.json(req), {
        responseType: ResponseType.Text
    });

    if (!resp.ok) 
        throw new Error(resp.data as string)

    const result = JSON.parse(resp.data as string)
    return result.vm.result
};

export type Session = {
    audioUrl : string
    videoUrl : string
    rtc_config: RTCConfiguration
}
export async function StartThinkmay(computer: Computer): Promise<Session> {
    const { address } = computer

    const turn = {
        minPort: WS_PORT,
        maxPort: 65535,
        port: getRandomInt(WS_PORT, 65535),
        username: crypto.randomUUID(),
        password: crypto.randomUUID(),
    }

    const thinkmay = {
        stunAddress: `stun:${address}:${turn.port}`,
        turnAddress: `turn:${address}:${turn.port}`,
        username: turn.username,
        credential: turn.password,
    }

    const display = {
        ScreenWidth: 1920,
        ScreenHeight: 1080,
    }

    const id = crypto.randomUUID()
    const req = {
        id,
        thinkmay,
        turn,
        display
    }

    const resp = await client.post(`http://${address}:${WS_PORT}/new`, Body.json(req), {
        responseType: ResponseType.JSON
    });

    if (!resp.ok)
        throw new Error(resp.data as string)

    return {
        audioUrl: `http://${address}:${WS_PORT}/handshake/client?token=${(resp.data as any).thinkmay.audioToken}`,
        videoUrl: `http://${address}:${WS_PORT}/handshake/client?token=${(resp.data as any).thinkmay.videoToken}`,
        rtc_config: {
            iceServers: [
                {
                    urls: `stun:${address}:${turn.port}`
                }, {
                    urls: `turn:${address}:${turn.port}`,
                    username: turn.username,
                    credential: turn.password,
                }
            ]
        }
    }
};



export async function StartMoonlight(computer: Computer, options? : StreamConfig, callback?: (type: "stdout" | "stderr", log: string) => void ): Promise<string> {
    const { address } = computer

    const PORT = getRandomInt(60000,65530)
    const sunshine = {
        username: getRandomInt(0, 9999).toString(),
        password: getRandomInt(0, 9999).toString(),
        port: PORT.toString()
    }

    const display = {
        ScreenWidth: 1920,
        ScreenHeight: 1080,
    }

    const id = getRandomInt(0, 100)
    const req = {
        id,
        timestamp: new Date().toISOString(),
        sunshine,
        display 
    }

    const resp = await client.post(`http://${address}:${WS_PORT}/new`, Body.json(req), {
        responseType: ResponseType.JSON,
    });



    if (!resp.ok)
        throw new Error(resp.data as string)
    else
        console.log('/new request return ' + resp.data)


    const { username, password } = sunshine
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
    ]
    console.log(`starting moonlight with ${cmds}`)
    const command = new Command('Moonlight', cmds);

    command.stderr.addListener('data', (data) => callback != undefined ? callback('stderr',data) : console.log(data));
    command.stdout.addListener('data', (data) => callback != undefined ? callback('stdout',data) : console.log(data));
    const child = await command.spawn()

    const ret = crypto.randomUUID()
    map.set(ret, { child, req: { ...req, computer } })

    return ret;
};



export async function CloseSession(uuid: string): Promise<Error | 'SUCCESS'> {
    const child = map.get(uuid)
    if (child == undefined)
        return new Error('invalid uuid')

    await child.child?.kill()

    console.log('/close request ' + child.req.id)
    await client.post(`http://${child.req.computer.address}:${WS_PORT}/closed`, Body.json({
        id: child.req.id
    }), { responseType: ResponseType.Text });

    return 'SUCCESS'
}




export async function ConfigureDaemon(address: string): Promise<Computer> {
    return {
        address
    }
}

export async function GetInfo(computer: Computer): Promise<any|Error> {
    const {address} = computer
    const {data,ok} = await client.post(`http://${address}:${WS_PORT}/info`, Body.json(computer), {
        timeout: 1000,
        responseType: ResponseType.JSON
    })

    if (!ok) 
        return new Error(`error ${JSON.stringify(data)}`)

    return data
}

export async function ResetDaemon(address: string): Promise<void> {
    const info = (await client.get(`http://${address}:${WS_PORT}/info`)).data as { 
        Sessions: {
            id: string
        }[]
    };


    console.log(info)
    const sessions = info.Sessions
    console.log(`running sessions : ${sessions.map(x => x.id)}`)
    for (let index = 0; index < sessions.length; index++) {
        await client.post(`http://${address}:${WS_PORT}/closed`, Body.json(sessions[index]), { 
            responseType: ResponseType.Text 
        });
    }
}



function getRandomInt(min: number, max: number) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}
async function JoinZeroTier(network_id: string): Promise<string> {
    const command = await new Command('ZeroTier', ['leave', network_id]).execute();
    return command.stdout + '\n' + command.stderr
}
async function LeaveZeroTier(network_id: string): Promise<string> {
    const command = await new Command('ZeroTier', ['join', network_id]).execute();
    return command.stdout + '\n' + command.stderr
}
async function DiscordRichPresence(app_id: string): Promise<string> {
    const command = await new Command('Daemon', ['discord', app_id]).execute();
    return command.stdout + '\n' + command.stderr
}