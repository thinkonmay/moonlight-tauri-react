import { Body, ResponseType, getClient } from '@tauri-apps/api/http';
import { Child, Command } from "@tauri-apps/api/shell";

// TODO /log & /info
// TODO log moonlight
// TODO api call status
// TODO loading



export const WS_PORT = 60000

const map = new Map<string, {
    child?: Child,
    req: StartRequest
}>()

const LoggingQueue = [] as {type: string, message: string}[]


export function Logging(event: {type: string, message: string}){
    console.log(event)
    LoggingQueue.push(event)
} 

export function GetLoggingMoonlight(): {type: string, message: string}[]{
    // return all value in Logging and clear it
    const ret = LoggingQueue.slice()
    LoggingQueue.length = 0
    return ret
}

export async function GetServerLog(address: string): Promise<{log: string, level: string, source: string, timestamp: string}[]>{ 
    const client = await getClient();
    const resp = (await client.get(`http://${address}:${WS_PORT}/log`)).data as {log: string, level: string, source: string, timestamp: string}[]

    return resp;
}

export function GetRequest(uuid: string): undefined | StartRequest {
    return map.get(uuid)?.req
}


type StartRequest = {
    sunshine?: {
        username: string,
        password: string,
        port: string
    }
    thinkmay?: {
        webrtcConfig: string
        authConfig: string
    }
    display?: {
        ScreenWidth: number,
        ScreenHeight: number,
    }

    timestamp: string
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

    turn?: {
        username: string,
        password: string,
        min_port: number,
        max_port: number,
        turn_port: number
    }

    rtc_config?: RTCConfiguration
}

export async function StartThinkmay(computer: Computer): Promise<string> {
    const client = await getClient();
    const { address } = computer

    const turn = {
        minPort: WS_PORT,
        maxPort: 65535,
        port: getRandomInt(WS_PORT, 65535),
        username: crypto.randomUUID(),
        password: crypto.randomUUID(),
    }

    const webrtc_config = {
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

    const thinkmay = {
        authConfig: '',
        webrtcConfig: JSON.stringify(webrtc_config)
    }

    const display = {
        ScreenWidth: 1920,
        ScreenHeight: 1080,
    }

    const id = getRandomInt(0, 100)
    const req = {
        id,
        timestamp: new Date().toISOString(),
        thinkmay,
        turn,
        display
    }

    const resp = await client.post(`http://${address}:${WS_PORT}/new`, Body.json(req), {
        responseType: ResponseType.Text
    });



    if (!resp.ok)
        throw new Error(resp.data as string)
    else
        console.log('/new request return ' + resp.data)

    const ret = crypto.randomUUID()
    computer.rtc_config = webrtc_config
    map.set(ret, { req: { ...req, computer } })

    return ret;
};



export async function StartMoonlight(computer: Computer, options? : StreamConfig, callback?: (type: "stdout" | "stderr", log: string) => void ): Promise<string> {
    const { address } = computer
    const client = await getClient();

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

    Logging({type: 'info', message: `Starting moonlight with ${JSON.stringify(req)}`});
    Logging({type: 'info', message: `POST http://${computer}:${WS_PORT}/new Body ${JSON.stringify(req)}`})
    const resp = await client.post(`http://${address}:${WS_PORT}/new`, Body.json(req), {
        responseType: ResponseType.Text
    });



    if (!resp.ok){
        Logging({type: 'info', message: 'Error /new request return ' + resp.data});
        throw new Error(resp.data as string)
    }
    else{
        Logging({type: 'info', message: 'Response /new request return ' + resp.data});
    }


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
    Logging({type: 'info', message: `starting moonlight with ${cmds}`});
    const command = new Command('Moonlight', cmds);

    command.stderr.addListener('data', (data) => callback != undefined ? callback('stderr',data) : console.log(data));
    command.stdout.addListener('data', (data) => callback != undefined ? callback('stdout',data) : console.log(data));
    const child = await command.spawn()

    const ret = crypto.randomUUID()
    map.set(ret, { child, req: { ...req, computer } })

    return ret;
};



export async function CloseSession(uuid: string): Promise<Error | 'SUCCESS'> {
    const client = await getClient();
    const child = map.get(uuid)
    if (child == undefined)
        return new Error('invalid uuid')

    await child.child?.kill()
    
    Logging({type: 'info', message: `killing child ${child.req.id}`});

    Logging({type: 'info', message: `POST http://${child.req.computer.address}:${WS_PORT}/closed Body ${child.req.id}`});
    await client.post(`http://${child.req.computer.address}:${WS_PORT}/closed`, Body.json({
        id: child.req.id
    }), { responseType: ResponseType.Text });

    return 'SUCCESS'
}




export async function ConfigureDaemon(address: string, reset: boolean): Promise<Computer> {
    let computer: Computer = {
        address
    }

    Logging({type: 'info', message: `POST http://${address}:${WS_PORT}/initialize Body ${JSON.stringify(computer)}`})
    const client = await getClient();
    try {
        await client.post(`http://${address}:${WS_PORT}/initialize`, Body.json(computer), {
            responseType: ResponseType.JSON
        });
    } catch { 
        Logging({type: 'info', message: `error sending /initialize request to ${JSON.stringify(computer)}`})
    }

    Logging({type: 'info', message: `GET http://${address}:${WS_PORT}/sessions`})
    const sessions = (await client.get(`http://${address}:${WS_PORT}/sessions`)).data as {
        id: any
    }[];

    if(sessions.length == 0){
        Logging({type: 'info', message: `no running sessions on ${address}`})
    }

    if (!reset)
        return computer

    Logging({type: 'info', message: `running sessions : ${sessions.map(x => x.id)}`})
    for (let index = 0; index < sessions.length; index++) {
        const element = sessions[index];
        Logging({type: 'info', message: `POST http://${address}:${WS_PORT}/closed Body ${JSON.stringify(element)}`})
        await client.post(`http://${address}:${WS_PORT}/closed`, Body.json(element), { responseType: ResponseType.Text });
    }

    Logging({type: 'info', message: `return ${JSON.stringify(computer)}`})
    return computer
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