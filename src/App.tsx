import "./App.css";

function App() {
  return (
    <>
      <div
        css={{
          backgroundColor: "hotpink",
          "&:hover": {
            color: "lightgreen",
          },
        }}
      >
        This has a hotpink background.
      </div>
      <h1 css={{ color: "pink" }}>Piper Wolf</h1>
      <p>
        The only way to learn is by playing. The only way to win is by learning.
        And the only way to begin is by beginning.
      </p>
      <img src="frog-spin.gif" />
    </>
  );
}

export default App;
