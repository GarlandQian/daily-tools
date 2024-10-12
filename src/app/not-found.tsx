'use client'
import './404.css';

export default function NotFound() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <title>GarlandQian - 404page</title>
      </head>
      <body>
        <div className="anim">
          <div className="tooltip">
            <span>Oh no...</span>
            <span>something wrong</span>
          </div>
          <div className="snail">
            <div className="snail__head">
              <div className="snail__eye snail__eye--left">
                <span className="snail__pupil" />
              </div>
              <span className="snail__stx snail__stx--left" />
              <div className="snail__eye snail__eye--right">
                <span className="snail__pupil" />
              </div>
              <span className="snail__stx snail__stx--right" />
              <div className="snail__body-top">
                <div className="snail__stom" />
              </div>
            </div>
            <div className="snail__body-bottom" />
            <div className="snail__body-caudatum" />
            <div className="snail__shell" />
          </div>
          <div className="text-content">
            <span>4</span>
            <span>0</span>
            <span>4</span>
          </div>
        </div>
      </body>
    </html>
  )
}
