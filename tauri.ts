import { Body, ResponseType, getClient } from '@tauri-apps/api/http';
import { Child, Command } from "@tauri-apps/api/shell";


const map = new Map<string, { child: Child, req: StartRequest }>()
type StartRequest = { 
    username: string, 
    password: string, 
    address: string, 
    id: number, 
}




export async function StartMoonlight(req: StartRequest): Promise<string> {
    const { username, password, address } = req
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

    command.stderr.addListener('data', (data) => console.log(data));
    command.stdout.addListener('data', (data) => console.log(data));
    const child = await command.spawn()

    const ret = crypto.randomUUID()
    map.set(ret, { child, req })

    return ret;
};



export async function CloseMoonlight(uuid: string): Promise<Error | 'SUCCESS'> {
    const client = await getClient();
    const child = map.get(uuid)
    if (child == undefined)
        return new Error('invalid uuid')

    await child.child.kill()
    console.log('/close request ' + child.req.id)
    await client.post(`http://${child.req.address}:60000/closed`, Body.json({
        id: child.req.id
    }), { responseType: ResponseType.Text });

    return 'SUCCESS'
}




export async function ConfigureDaemon(address: string): Promise<StartRequest> {
    const client = await getClient();
    try {
        await client.post(`http://${address}:60000/initialize`, Body.json({}), { responseType: ResponseType.Text });
    } catch { }

    const sessions = (await client.get(`http://${address}:60000/sessions`)).data as {
        id: any
    }[];

    for (let index = 0; index < sessions.length; index++) {
        const element = sessions[index];
        console.log('/close request ' + element.id)
        await client.post(`http://${address}:60000/closed`, Body.json(element), { responseType: ResponseType.Text });
    }



    const sunshine = {
        username: getRandomInt(0, 9999).toString(),
        password: getRandomInt(0, 9999).toString()
    }

    const id = getRandomInt(0, 100)
    const resp = await client.post(`http://${address}:60000/new`, Body.json({
        id,
        timestamp: new Date().toISOString(),
        sunshine,
        display: {
            ScreenWidth: 1920,
            ScreenHeight: 1080,
        }
    }), { responseType: ResponseType.Text }
    );



    if (!resp.ok)
        throw new Error(resp.data as string)
    else
        console.log('/new request return ' + resp.data)


    return {
        ...sunshine,
        address,
        id,
    }
}


function getRandomInt(min: number, max: number) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}

async function JoinZeroTier(network_id: string): Promise<string> {
    const command = await new Command('ZeroTier', ['leave',network_id]).execute();
    return command.stdout + '\n' + command.stderr
}
async function LeaveZeroTier(network_id: string) : Promise<string> {
    const command = await new Command('ZeroTier', ['join',network_id]).execute();
    return command.stdout + '\n' + command.stderr
}