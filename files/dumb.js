/*
 * Description: Make a user (spammer) dumb (mute)
 * Author: simple
 */

import * as UAC from '../utility/UAC/_info';
import * as Invite from '../core/invite';

// module constructor
export function init(core) {
  if (typeof core.muzzledHashes === 'undefined') {
    core.muzzledHashes = {};
  }
}

// module main
export async function run(core, server, socket, data) {
  // increase rate limit chance and ignore if not admin or mod
  if (!UAC.isModerator(socket.level)) {
    server.reply({
      cmd:'warn',
      text:'权限不足，无法操作'
    })
    return server.police.frisk(socket.address, 10);
  }

  // check user input
  if (typeof data.nick !== 'string') {
    return true;
  }

  // find target user
  let badClient = server.findSockets({ channel: socket.channel, nick: data.nick });
  if (badClient.length === 0) {
    return server.reply({
      cmd: 'warn',
      text: '不能在聊天室找到该用户',
    }, socket);
  }

  [badClient] = badClient;

  // likely dont need this, muting mods and admins is fine
  if (badClient.level >= socket.level) {
    return server.reply({
      cmd: 'warn',
      text: '您是我见过最粗鲁的一名管理员，竟敢自相残杀。',
    }, socket);
  }

  // store hash in mute list
  const record = core.muzzledHashes[badClient.hash] = {
    dumb: true,
  };

  // store allies if needed
  if (data.allies && Array.isArray(data.allies)) {
    record.allies = data.allies;
  }

  // notify mods
  server.broadcast({
    cmd: 'info',
    text: `${socket.nick} 已在 ?${socket.channel} 禁言 ${badClient.nick}\n被禁言的用户的hash为：${badClient.hash}`,
  }, { level: UAC.isModerator });
  server.broadcast({
    cmd:'info',
    text:`已禁言 ${badClient.nick}`
  },{channel:socket.channel,level:(level) => level < UAC.levels.moderator});

  return true;
}

// module hook functions
export function initHooks(server) {
  server.registerHook('in', 'chat', this.chatCheck.bind(this), 10);
  server.registerHook('in', 'invite', this.inviteCheck.bind(this), 10);
  server.registerHook('in', 'whisper', this.whisperCheck.bind(this), 10);
  server.registerHook('in', 'emote', this.emoteCheck.bind(this), 10);
  server.registerHook('in', 'chat', this.dumbCheck.bind(this));
}

// hook incoming chat commands, shadow-prevent chat if they are muzzled
export function chatCheck(core, server, socket, payload) {
  if (typeof payload.text !== 'string') {
    return false;
  }

  if (core.muzzledHashes[socket.hash]) {
    // build fake chat payload
    const mutedPayload = {
      cmd: 'warn',
      text: '你已被管理员禁言，无法发送信息。',
    };


    // broadcast to any duplicate connections in channel
    server.reply(mutedPayload,socket);

    /**
      * Blanket "spam" protection.
      * May expose the ratelimiting lines from `chat` and use that
      * @todo one day #lazydev
      */
    server.police.frisk(socket.address, 9);

    return false;
  }

  return payload;
}
export function emoteCheck(core, server, socket, payload) {
  if (typeof payload.text !== 'string') {
    return false;
  }

  if (core.muzzledHashes[socket.hash]) {
    // build fake chat payload
    const mutedPayload = {
      cmd: 'warn',
      text: '你已被管理员禁言，无法发送信息。',
    };


    // broadcast to any duplicate connections in channel
    server.reply(mutedPayload,socket);

    /**
      * Blanket "spam" protection.
      * May expose the ratelimiting lines from `chat` and use that
      * @todo one day #lazydev
      */
    server.police.frisk(socket.address, 9);

    return false;
  }

  return payload;
}

// shadow-prevent all invites from muzzled users
export function inviteCheck(core, server, socket, payload) {
  if (core.muzzledHashes[socket.hash]) {
    const nickValid = Invite.checkNickname(payload.nick);
    if (nickValid !== null) {
      server.reply({
        cmd: 'warn',
        text: nickValid,
      }, socket);
      return false;
    }

    // generate common channel
    const channel = Invite.getChannel();

    // send fake reply
    server.reply({cmd:'warn',text:'你已被管理员禁言，无法发送信息。'},socket);

    return false;
  }

  return payload;
}

// shadow-prevent all whispers from muzzled users
export function whisperCheck(core, server, socket, payload) {
  if (typeof payload.nick !== 'string') {
    return false;
  }

  if (typeof payload.text !== 'string') {
    return false;
  }

  if (core.muzzledHashes[socket.hash]) {
    const targetNick = payload.nick;

    server.reply({
      cmd: 'warn',
      text: `你已被管理员禁言，无法发送信息。`,
    }, socket);

    // blanket "spam" protection, may expose the ratelimiting lines from `chat` and use that, TODO: one day #lazydev
    server.police.frisk(socket.address, 9);

    return false;
  }

  return payload;
}

// hooks chat commands checking for /nick
export function dumbCheck(core, server, socket, payload) {
  if (typeof payload.text !== 'string') {
      return false;
  }

  if (payload.text.startsWith('/dumb')) {
      const input = payload.text.split(' ');

      // If there is no nickname target parameter
      if (input[1] === undefined) {
          server.reply({
              cmd: 'warn',
              text: '命令语法有误，请发送 `/help dumb` 来查看这个命令的正确使用方法。',
          }, socket);

          return false;
      }


      this.run(core, server, socket, {
          cmd: 'dumb',
          nick: input[1],
      });

      return false;
  }

  return payload;
}

export const requiredData = ['nick'];
export const info = {
  name: 'dumb',
  description: '禁言某个用户',
  usage: `
    API: { cmd: 'dumb', nick: '<目标用户的昵称>'}
    文本：以聊天形式发送 /dumb 目标昵称`,
};
info.aliases = ['muzzle', 'mute'];
