export const Moonlight = () => {
    const [showLoginForm, setLoginForm] = useState(false);

    return <>
        {showLoginForm ? (
            <LoginForm
                close={() => setLoginForm(false)}
            ></LoginForm>
        ) : (
            <div>
                <span className="text-base text-white font-medium">
                    Continue with
                </span>
                <div className="flex gap-[8px]">
                    <button
                        className="base discord_button"
                        onClick={() => proceed('discord')}
                    >
                        <Icon src="discord" width={64} />
                    </button>
                    <button
                        className="base gg_button"
                        onClick={() => proceed('google')}
                    >
                        <Icon src="google" width={64} />
                    </button>

                    <butotn
                        className="base ml_button"
                        onClick={() => setLoginForm(true)}
                    >
                        Monlight
                    </butotn>
                </div>
            </div>
        )}
    </>
}




const LoginForm = ({ close }) => {
    const [username, setUsername] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        await appDispatch(local_access({address: username }));
        appDispatch(open_remote());
        await ready()
    };

    return (
        <div className="login-container">
            <form className="login-form" onSubmit={handleLogin}>
                <h2>Login</h2>
                <div className="form-group">
                    <label htmlFor="username">Username:</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div className="flex gap-2">
                    <button className="btn-login" type="submit">
                        Login
                    </button>

                    <button
                        onClick={close}
                        className="bg-slate-600"
                        type="button"
                    >
                        Close
                    </button>
                </div>
            </form>
        </div>
    );
};