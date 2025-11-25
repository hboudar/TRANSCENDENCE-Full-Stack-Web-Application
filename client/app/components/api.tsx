export default async function Api() {
    const users = await fetch('https://localhost/users')
        .then((res) => res.json())
        .catch((err) => console.error(err));
    const messages = await fetch('https://localhost/messages')
        .then((res) => res.json())
        .catch((err) => console.error(err));
    const user = await fetch('https://localhost/user')
        .then((res) => res.json())
        .catch((err) => console.error(err));
    return {
        users
    };
}
