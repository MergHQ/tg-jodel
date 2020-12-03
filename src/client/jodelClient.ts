import axios, { AxiosError } from 'axios'
import { JSDOM } from 'jsdom'
import * as R from 'ramda'
import { parse } from 'url'
import * as O from 'fp-ts/Option'
import * as TE from 'fp-ts/TaskEither'
import { pipe } from 'fp-ts/lib/function'

export type JodelPost = {
  poster: string
  timeStr: string
  postContent: string
  score: string
}

const errorPost: JodelPost = {
  poster: '',
  timeStr: '',
  postContent: 'Cannot parse post',
  score: '0',
}

const parseTextContent: (text: string) => O.Option<JodelPost> = R.pipe(
  R.trim,
  R.replace(/\n/g, ''),
  R.split(' '),
  R.filter<string>(s => s.length > 0),
  O.fromPredicate(p => p.length > 0),
  O.map(([poster, _1, timeVal, timeUnits, _2, ...tail]) => ({
    poster,
    timeStr: `${timeVal} ${timeUnits} ago`,
    postContent: R.dropLast(1, tail).join(' '),
    score: R.last(tail),
  }))
)

const getJodelReplies = (url: string): TE.TaskEither<AxiosError, string[]> =>
  pipe(
    TE.tryCatch(
      () => axios.get(url),
      (reason: AxiosError) => reason
    ),
    TE.chain(({ data }) =>
      data.next
        ? pipe(
            getJodelReplies(`${url}?next=${data.next}`),
            TE.map(R.concat([data.html]))
          )
        : TE.of([data.html])
    )
  )

export const getPostContent = (
  postUrl: string
): TE.TaskEither<Error, JodelPost[]> => {
  const { postId } = parse(postUrl, true).query

  return postId
    ? pipe(
        getJodelReplies(`https://share.jodel.com/post/${postId}/replies`),
        TE.map(htmlParts => new JSDOM(htmlParts.join(''))),
        TE.map(
          dom =>
            Array.from(
              dom.window.document.querySelectorAll('.list-group-item')
            ) as any[]
        ),
        TE.map(
          R.map(e =>
            pipe(
              e.textContent,
              parseTextContent,
              O.getOrElse(() => errorPost)
            )
          )
        ),
        TE.mapLeft(() => new Error('Error fetching post data'))
      )
    : TE.left(new Error('Post ID not found in URL'))
}
