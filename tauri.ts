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

export function GetRequest(uuid: string): StartRequest {
    return map.get(uuid).req
}


type StartRequest = {
    sunshine?: {
        username: string,
        password: string,
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



export async function StartMoonlight(computer: Computer, callback?: (type: "stdout" | "stderr", log: string) => void ): Promise<string> {
    const { address } = computer
    const client = await getClient();

    const sunshine = {
        username: getRandomInt(0, 9999).toString(),
        password: getRandomInt(0, 9999).toString()
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
        responseType: ResponseType.Text
    });



    if (!resp.ok)
        throw new Error(resp.data as string)
    else
        console.log('/new request return ' + resp.data)


    const { username, password } = sunshine
    const cmds = [
        '--url',
        address,
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
    const client = await getClient();
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




export async function ConfigureDaemon(address: string, reset: boolean): Promise<Computer> {
    let computer: Computer = {
        address
    }

    console.log(`configuring daemon`)
    const client = await getClient();
    try {
        await client.post(`http://${address}:${WS_PORT}/initialize`, Body.json(computer), {
            responseType: ResponseType.JSON
        });
    } catch { }

    const sessions = (await client.get(`http://${address}:${WS_PORT}/sessions`)).data as {
        id: any
    }[];

    if (!reset)
        return computer

    console.log(`running sessions : ${sessions.map(x => x.id)}`)
    for (let index = 0; index < sessions.length; index++) {
        const element = sessions[index];
        console.log('/close request ' + element.id)
        await client.post(`http://${address}:${WS_PORT}/closed`, Body.json(element), { responseType: ResponseType.Text });
    }

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