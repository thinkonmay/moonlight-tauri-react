import { Child, Command } from "@tauri-apps/api/shell";



const map = new Map<string, Child>()
let log_raw = ''

export async function StartMoonlight({ username, password, address }: { username: string, password: string, address: string }): Promise<string> {
    const command = new Command('Moonlight', [
        '--url',
        address,
        '--username',
        username,
        '--password',
        password
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
    const ret : string[] = []
    log_raw.split('\n').forEach(x => x.split('\r').forEach(y => ret.push(y)))
    log_raw = ''
    return ret
}