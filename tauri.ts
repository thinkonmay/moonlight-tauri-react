import { Child, Command } from "@tauri-apps/api/shell";



const map = new Map<string, Child>()
let log_raw = ''

type StartRequest = { username: number, password: number, address: string }
export async function StartMoonlight({ username, password, address }: StartRequest): Promise<string> {
    const command = new Command('Moonlight', [
        '--url',
        address,
        '--username',
        username.toString(10),
        '--password',
        password.toString(10)
    ]);

    command.stderr.addListener('data', (data) => log_raw += data);
    command.stdout.addListener('data', (data) => log_raw += data);
    const child = await command.spawn()

    const ret = crypto.randomUUID()
    map.set(ret, child)

    return ret;
};



export async function CloseMoonlight(uuid: string): Promise<Error | 'SUCCESS'> {
    const child = map.get(uuid)
    if (child == undefined)
        return new Error('invalid uuid')

    await child.kill()
    return 'SUCCESS'
}


export function TakeLog(): string[] {
    const ret: string[] = []
    log_raw.split('\n').forEach(x => x.split('\r').forEach(y => ret.push(y)))
    log_raw = ''
    return ret
}


export async function ConfigureDaemon(address: string): Promise<StartRequest> {
    let resp = await fetch(`http://${address}/initialize`, {
        method: 'POST',
        body: JSON.stringify({})
    });


    resp = await fetch(`http://${address}/info`);

    const sunshine = {
        username: getRandomInt(0, 9999),
        password: getRandomInt(0, 9999)
    }

    resp = await fetch(`http://${address}/new`, {
        method: 'POST',
        body: JSON.stringify({
            id: 0,
            timestamp: new Date().toISOString(),
            sunshine
        })
    });


    return { ...sunshine, address }
}


function getRandomInt(min: number, max: number) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}