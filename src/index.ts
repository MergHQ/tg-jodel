import * as R from 'ramda'
import { getPostContent, JodelPost } from './client/jodelClient'
import * as TgClient from 'node-telegram-bot-api'
import { pipe } from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import * as TE from 'fp-ts/TaskEither'

const client = new TgClient(process.env.BOT_TOKEN, { polling: true })

const formatPost = (post: JodelPost) => `
[${post.poster} · ${post.timeStr} · ${Number(post.score) < 0 ? '⬇️' : '⬆️'} ${
  post.score
}]

${post.postContent}
`

const sendPartitions = async (chat: TgClient.Chat, partitions: string[][]) => {
  for (let p of partitions) {
    await client.sendMessage(chat.id, p.join('\n'))
  }
}

client.onText(/\/expand/g, message =>
  pipe(
    O.fromNullable(message.text),
    O.map(text => {
      const [_, postUrl] = text.split(' ')

      return getPostContent(postUrl)
    }),
    O.map(
      TE.fold(
        e => TE.of(console.error(e)),
        posts => {
          const partitioned = R.splitEvery(5, posts.map(formatPost))
          return TE.tryCatch(
            () => sendPartitions(message.chat, partitioned),
            (e: Error) => e
          )
        }
      )
    ),
    O.map(TE.mapLeft(e => console.error(e))),
    O.map(executable => executable())
  )
)
