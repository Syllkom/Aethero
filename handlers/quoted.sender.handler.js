export default {
    enabled: true,
    priority: 1.2,
    script: async function () {
        const m = this;
        if (!this.contextInfo?.quotedMessage) return;

        this.quoted.sender = {
            id: this.quoted.key.participant,
            number: this.quoted.key.participant?.split('@')[0] || undefined,
            user: '@' + this.quoted.key.participant?.split('@')[0] || undefined,
            get isAdmin() {
                if (!m.__groupMetaData) return;
                return m.chat.admins?.includes(this.id) || false
            }
        }
    }
}