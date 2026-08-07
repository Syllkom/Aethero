export default {
    enabled: true,
    priority: 0.1,
    script: async function ({ sock }) {
        const m = this;
        this.bot = {
            get isAdmin() {
                if (!m.__groupMetaData) return;
                return m.chat.admins?.includes(this.id) || false
            }
        };

        this.bot.id = sock.user.lid.includes(':') ? (sock
            .user.lid.split(":")[0] + "@lid") : sock.user.lid
        this.bot.user = '@' + this.bot.id?.split('@')[0] || undefined
        this.bot.number = sock.user?.id?.split(':')[0] || undefined;
        this.bot.name = sock.user.name || '';
        this.bot.fromMe = this.raw.key.fromMe;
    }
}