export default async function Api() {
    const users = await fetch('https://10.32.118.247/users')
        .then((res) => res.json())
        .catch((err) => console.error(err));
    return {
        users
    };
}
