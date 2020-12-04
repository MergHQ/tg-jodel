import * as R from 'ramda'
import { getPostContent, JodelPost } from './client/jodelClient'
import * as TgClient from 'node-telegram-bot-api'
import { pipe } from 'fp-ts/lib/function'
import * as O from 'fp-ts/Option'
import * as TE from 'fp-ts/TaskEither'
import { lookup } from 'fp-ts/lib/Array'

const client = new TgClient(process.env.BOT_TOKEN, { polling: true })

const formatPost = (post: JodelPost) => `
[${post.poster} · ${post.timeStr} · ${Number(post.score) < 0 ? '⬇️' : '⬆️'} ${post.score}]

${post.postContent}
`

const sendPartitions = async (chat: TgClient.Chat, partitions: string[][]) => {
  for (let p of partitions) {
    await client.sendMessage(chat.id, p.join('\n'))
  }
}

client.onText(/\/expand/g, ({ text, chat }) => {
  if (!text) return

  pipe(
    text.split(' '),
    lookup(1),
    O.map(postUrl =>
      pipe(
        postUrl,
        getPostContent,
        TE.chain(posts => {
          const partitioned = R.splitEvery(5, posts.map(formatPost))
          return TE.tryCatch(
            () => sendPartitions(chat, partitioned),
            (e: Error) => e
          )
        }),
        TE.mapLeft(error => console.error(error))
      )
    ),
    O.fold(
      () => console.log('No argument given'),
      doAction => doAction()
    )
  )
})
