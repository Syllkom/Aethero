export const CATEGORIES = {
    1: 'CONTENT', 0: 'SYSTEM',
    W: 'WRAPPER'
}

export const WRAPPER_TYPES = new Set([
    'ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2',
    'viewOnceMessageV2Extension', 'documentWithCaptionMessage',
    'deviceSentMessage', 'editedMessage'
])

export const SYSTEM_TYPES = new Set([
    'messageContextInfo', 'senderKeyDistributionMessage', 'fastRatchetKeySenderKeyDistributionMessage',
    'protocolMessage', 'chat', 'call', 'callLogMesssage', 'scheduledCallCreationMessage',
    'scheduledCallEditMessage', 'bcallMessage', 'keepInChatMessage', 'pinInChatMessage',
    'stickerSyncRmrMessage', 'encReactionMessage', 'encCommentMessage', 'encEventResponseMessage',
    'messageHistoryBundle', 'messageHistoryNotice', 'placeholderMessage', 'secretEncryptedMessage',
    'statusNotificationMessage', 'statusMentionMessage', 'groupStatusMentionMessage',
    'groupStatusMessage', 'groupStatusMessageV2', 'statusAddYours', 'statusQuestionAnswerMessage',
    'statusQuotedMessage', 'statusStickerInteractionMessage'
])

export const getCategoryCode = (type) => {
    if (WRAPPER_TYPES.has(type)) return 'W'
    if (SYSTEM_TYPES.has(type)) return 0
    return 1
}

export const resolveMessage = (msg) => {
    let currentMsg = msg || {}
    let type = Object.keys(currentMsg).find(k => getCategoryCode(k) !== 0)
        || Object.keys(currentMsg).find(k => getCategoryCode(k) === 0)

    while (type && getCategoryCode(type) === 'W') {
        currentMsg = currentMsg[type]?.message || {}
        type = Object.keys(currentMsg).find(k => getCategoryCode(k) !== 0)
            || Object.keys(currentMsg).find(k => getCategoryCode(k) === 0)
    }

    return {
        category: CATEGORIES[getCategoryCode(type)] || 'UNKNOWN',
        messageData: currentMsg[type] || {},
        type: type
    }
}