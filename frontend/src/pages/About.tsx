import { Link } from 'react-router-dom'
import { Bulldog } from '../components/Logo'

export default function About() {
  return (
    <div className="container about-page">
      <div className="about-hero">
        <div className="about-dog">
          <Bulldog size={120} />
        </div>
        <div>
          <span className="eyebrow eyebrow-dark">About us</span>
          <h1>Made for the Bulldog family.</h1>
          <p className="lead">
            Campus Customs is a merch shop for Yale gear — for students heading to class, alumni heading back for
            The Game, and the moms, dads and grandparents who wear the blue with pride.
          </p>
        </div>
      </div>

      <div className="about-grid">
        <div className="about-card">
          <h2>Every corner of campus</h2>
          <p>
            From residential college crests to the graduate and professional schools, varsity
            sports and the classic big YALE — there’s a piece for every part of your Yale story.
          </p>
        </div>
        <div className="about-card">
          <h2>Honest prices &amp; stock</h2>
          <p>
            Prices and size availability on this site come straight from our shop inventory. If a size is sold
            out, we’ll tell you — no surprises at checkout.
          </p>
        </div>
        <div className="about-card">
          <h2>Ask Handsome Dan</h2>
          <p>
            Our chat assistant (bottom-right corner) is named for Yale’s famous bulldog mascot. Soon he’ll help you
            find the right fit, color and gift.
          </p>
        </div>
      </div>

      <div className="about-cta">
        <Link to="/products" className="btn">
          Start shopping
        </Link>
      </div>
    </div>
  )
}
