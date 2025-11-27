export default async function Api() {
    const users = await fetch('https://localhost/users')
        .then((res) => res.json())
        .catch((err) => console.error(err));
    return {
        users
    };
}
