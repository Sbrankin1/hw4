# AI Prompts Log — Homework 4

## Set-up prompt

### Prompt 1
> I want you to start a log called AI_prompts.md, in it you should log all of the prompts I give you to each problem, I will make sure that I include the name of the problems so you can follow along.
> I have also included a list of all of the folder and file names that I will need. If I give you one that has slightly different spelling, double check with me, but we should not be adding any more files and such than the ones here. You can also call this set - up prompt.
>
> *[Attached image: required folder/file structure]*
> ```
> hw4/
> ├── AI_prompts.md
> ├── requirements.txt
> ├── .env.example
> ├── .gitignore
> ├── README.md
> ├── frontend/                  # Vite React TypeScript app
> ├── backend/
> │   ├── main.py                # FastAPI app — run with: uvicorn main:app ...
> │   ├── agent.py
> │   ├── models.py
> │   ├── tools.py
> │   └── prompts/
> │       └── prompt.md
> └── output/
>     ├── harness.md
>     ├── design.md
>     ├── usability.md
>     ├── app_check.html
>     ├── app_check_images/      # screenshots linked from app_check.html
>     └── audit_trail.json
> ```

## Problem 1: Vibe coder prompts

### Prompt 1
> okay perfect, here is the overall scenario:
> Campus customer - a merch store for yale gear, is needing a real customer website with a helpful chatbot. I need to build a react+vite typescript front end and a python fast API backend, whos brain is a pydantic AI agent.
> Shoppers should be able to browse products, create an account, chat about merch, see matching items appear on the page, and get honest answers about price and stock from a local database.
>
> I will be given campus_customers.db with tables for the product catalogue, inventory by size and users with hashed passwords. Product file images paths are in the table.

## Problem 2: Analyze the database

### Prompt 1
> the folder "Data 3" now exists in my desktop>AI foundations folder. In there you will find the campus_customs.db file, next you will start the file output/harness.md and write down each table and its fields, writing down a short line on why each field is important for the shop or the chatbot.

### Prompt 2
> So for the things that overlap, why don't we create the categories and sub-categories to be able to differentiate those things?

### Prompt 3
> Yes, lets include themes, I think that is a great idea!

## Problem 3 prompts: Build the Campus Customs website

### Prompt 1
> Perfect! Now I want to build the website for campus groups. The yale bulldog theme should be maintained throughout.
> It should be made as a react+vite+typescript front end, should have a navigation bar at the top that links to the main pages:
> Home, products, about us, log in, create account.
>
> On the products page, show product images from the catalogue, use image paths in the database for this. with basic product info like name, price and a short description.
>
> Make each product a open a single-item page, large item on one side, full product text and details on the other. Should have price/stock/size/description. Also have category buttons that show which category it is so you cann access "more like this"
> Clicking a card on products should take the shopper to those pages.
>
> Add a chat interface in the bottom right side of the screen, a floating chat panel. It does not need to talk to an agent yet, we will call the backend later.
>
> I will need a small API to read the database, have a simple fastAPI app in backend/main just to serve products and images, then we will continue to grow this later.

### Prompt 2
> Here are some sample layouts from websites, use these as inspiration for the web design
>
> These should all also be in the "problem 3 prompts: build the campus customs website"
>
> *[Attached 6 screenshots: Apple Store (big "Store" title with tagline on the right, horizontal row of category icons, "The latest." two-tone headings with rounded dark/white scrolling cards, "Help is here" cards, "The Apple Store difference" feature cards with coloured text) and NEXT (search left / centred wordmark / account + checkout right, uppercase letter-spaced nav row, edge-to-edge split hero photos with label tags and "FEATURING" overlay, centred serif "Style & Inspiration" scrolling carousel with TRENDING labels, and grids of image tiles with centred uppercase names grouped as FEATURED / SPORTS / LUXURY)]*

## Problem 4: Create account and login

### Prompt 1
> Build a normal create-account/login flow
>
> Create account should have first name, last name, email, password, confirm password.
>
> Login, email and password
>
> New accounts should go into the users table, make sure to store passwords securely so hackers, human or AI cannot access them!
>
> The seed database already has a test user, the rest should be added to that!
>
> then update the output/harness.md with how authorization works, what you store for a user and how passwords are protected!

## Problem 5: Pydantic AI agent backend

### Prompt 1
> Now I want to build the shop chatbot as a pydantic AI agent behind a  FastAPI plugged into the front end chat widget. The app should be in backend/main.py - this is the file that will run with uvicorn, keep the agest as these four files next to it.
> Backend/prompts/prompt.md - system flow of what is asked etc
> Backend/agent.py - agent entry/writing
> Backend/tools.py - tools the agent can call
> Backend/models.py - pydantic/pydanticAI structured types
>
> In main.py expose a chat route so a message from the website returns a reply from the agent, and whatever else you need say products or authorizations. Use the API key for the agent that we have.
>
> Put campus customs voice and safety basics in to prompts/prompt.md more on this later
> start or update model types in models.py for chat replies/product cards needed.
>
> In output/harness.md note how the front end talks to fastAPI and how the agent is loaded, prompt file + model
>
> Make sure the backend runs from the backend/ folder like this:
> uvicorn main:app --reload --port 8000

## Problem 6: Tools — product info and stock

### Prompt 1
> The agent should have tools that lookup real information from campus_customs.db
> like product description
> Price
> how many are in stock by size
>
> The agent must use the database, it should not invent prices or quantities. If a size is out of stock, display that clearly.
>
> Expand prompts/prompt.md so the agent knows to call these tools for the price and stock questions. Add or update the return types in models.py
>
> Output/harness.md should list each tool and explain which model fields you chose for which lookup results and why

## Problem 7: Chat search that updates the page

### Prompt 1
> Now we will add a feature that means when customers ask the chat function about a product, like a "what hoodies do you have?" it will search the catalogue and the website should dynamically change to show those matching items as product cards, should have the image, name, price, short info.
>
> This is an API contract: the agent returns structured product matches and then the front end renders them on the website.
>
> after the dynbamic product cards are loaded, make sure the same single-item page behaviour from problem 3 still works, each product card - including the ones just pulled from the chat to the page, should still open ithat detail view when clicked.
>
> Update prompts/prompt.md and output/harness.md so it is clear how search results reach the page

## Problem 8: Customer memory

### Prompt 1
> When a shopper is logged in, save their chat history in the database in an appropriate table and reload it when they return. The agent should know who is chatting, name, email, put that in the agent dependencies or an equivalent clear patters and or tools the agent can call.
> Also pass enough page context that if someone is on a product page and asks do you ahve this in pink, the agent knows what they mean. Put it into the agent context.
>
> Guests can still chat, but history only persists for logged-in users
>
> Document in output/harness.md how user chat history is stored, what customer fields the agent sees and how page context is passed

## Problem 9: Usability improvements

### Prompt 1
> Now thatthe core shop works, I want you to track what the two front end usability improvements we made when I gave you the reference images.
>
> We will do the same for backend,
>
> Write output/usability.md for each of the improvements. Say what you added and why it helped the business.
>
> For backend, lets make sure that the agent being able to pull things from categories and themes is mentioned. Those were two good backend decisions for helping the agent work. Also maybe mention on the front end the category boxes/more like this additions we put in place

## Problem 10: Style the website

### Prompt 1
> Write output/design.md about how we made changes with the apple and next reference images. what did that do to keep customers on the site? keep it concrete and short

## Problem 11: Site testing (app check)

### Prompt 1
> Launch the site so that I can see what it is looking like

### Prompt 2
> okay for problem 11 we are adding screenshots to a html with short descriptions of functionality tresting.
>
> 1 - checking sizes from the chat. it did a greta job, I actually asked it multiple questions to get to this and was deliberately vague and it still worked it out.
>
> 2 - Did a pretty good job at the search, maybe added a little too much as I think some of those are sweaters not t shirts
>
> 3- the layout of the bar with all the options scrolls REALLY nice and simply. it works really well and I am pleased.
>
> put these into output/app_check.html
>
> Put the images into output/app_check_images/
> then link them to the app_check.html file
> with relevant paths
>
> *[Attached 3 screenshots: (1) Yale Sports Hoodie Hockey product page with the chat answering size inventory; (2) "Yale crewnecks" chat picks page for "how me more crew neck t shirts"; (3) home page "Shop." sub-category icon row and "The latest." cards]*

## Problem 12: Audit trail, safety, and harness

### Prompt 1
> keep an append only output/audit_trail.json of agent loop activity time, (tool name, time, short args/result, stop reason) do not wipe it between runs. also put these rules into prompts/prompt.md:
> do not share the data online anywhere
> do not email the customers
> do not share passwords
>
> Make sure outputs/harness.md is complete with all of the categories filled
> specs, afety rules, tools and abilities, model fields and what they do

## Problem 13: Push to GitHub and submit the URL

### Prompt 1
> Before we finish the upload, this is some feedback I have had on previous tasks, I want to make sure that we have followed the directions well and that we won't run into some of these silly mistakes now. I have included again for reference the expected file layout so that we know what it should include and in what format. Please check spelling to make sure everything gets called correctly and there are not any issues/huge missing parts.
>
> *[Attached: grade feedback from Homework 2 (86/100) and an earlier homework (52/100), plus the expected hw4/ file layout]*

### Prompt 2
> https://github.com/Sbrankin1/hw4.git
>
> Here is the link
