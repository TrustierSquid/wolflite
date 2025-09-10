

export default function SideNav(props){
  return (
    <section id="profileSection">
      <div id="userInformation">
        <h3>Welcome back <span style={{color: "crimson"}}>{props.loggedInUsername}!</span></h3>
        <h5 style={{color: "grey", textAlign: "center"}}>UserID#: {props.loggedInUserId}</h5>
        <br />
        <article id="sideNavButtonContainer">
          <button className="sideNavButton" onClick={()=> window.location.href = '/blog'}>Home</button>
          <button className="sideNavButton" onClick={()=> window.location.href = '/'}>Logout <i className="fa-light fa-left-from-bracket" style={{color: "#ffffff;"}}></i></button>
        </article>
        <button className="sideNavButton" onClick={()=> window.location.href = '/create'}>Create Post +</button>
        <button className="sideNavButton" onClick={()=> window.location.href = '/create'}>Changelog</button>
      </div>
    </section>
  )
}