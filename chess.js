// return a square with the chess piece
function Square(props) {
  if (props.value != null) {
    return (
      <button
        className={"square " + props.color + props.corner + props.cursor}
        onClick={props.onClick}
      >
        {props.value.icon}
      </button>
    );
  } else {
    return (
      <button
        className={"square " + props.color + props.corner + props.cursor}
        onClick={props.onClick}
      >
        {" "}
      </button>
    );
  }
}

class Board extends React.Component {
  // initialize the board
  constructor() {
    super();
    this.state = {
      squares: initializeBoard(),
      source: -1,
      turn: "w",
      true_turn: "w",
      turn_num: 0,
      first_pos: null,
      second_pos: null,
      repetition: 0,
      white_king_has_moved: 0,
      black_king_has_moved: 0,
      left_black_rook_has_moved: 0,
      right_black_rook_has_moved: 0,
      left_white_rook_has_moved: 0,
      right_white_rook_has_moved: 0,
      passant_pos: 65,
      bot_running: 0,
      pieces_collected_by_white: [],
      pieces_collected_by_black: [],
      history: [initializeBoard()],
      history_num: 1,
      history_h1: [null],
      history_h2: [null],
      history_h3: [null],
      history_h4: [null],
      history_white_collection: [null],
      history_black_collection: [null],
      mated: false,
      move_made: false,
      capture_made: false,
      check_flash: false,
      viewing_history: false,
      just_clicked: false,
    };
  }

  // returns true if castling is allowed
  castling_allowed(start, end, squares) {
    const copy_squares = squares.slice();
    var player = copy_squares[start].player;
    var delta_pos = end - start;
    if (start != (player == "w" ? 60 : 4)) return false;
    if (
        (delta_pos == 2
            ? copy_squares[end + 1].ascii
            : copy_squares[end - 2].ascii) != (player == "w" ? "r" : "R")
    )
      return false;
    if (
        (player == "w"
            ? this.state.white_king_has_moved
            : this.state.black_king_has_moved) != 0
    )
      return false;
    if (player == "w") {
      if (
          (delta_pos == 2
              ? this.state.right_white_rook_has_moved
              : this.state.left_white_rook_has_moved) != 0
      )
        return false;
    } else if (player == "b") {
      if (
          (delta_pos == 2
              ? this.state.right_black_rook_has_moved
              : this.state.left_black_rook_has_moved) != 0
      )
        return false;
    }

    return true;
  }

  // returns true if a piece is trying to skip over another piece
  blockers_exist(start, end, squares) {
    var start_row = 8 - Math.floor(start / 8);
    var start_col = (start % 8) + 1;
    var end_row = 8 - Math.floor(end / 8);
    var end_col = (end % 8) + 1;
    let row_diff = end_row - start_row;
    let col_diff = end_col - start_col;
    let row_ctr = 0;
    let col_ctr = 0;
    const copy_squares = squares.slice();

    // return true if the piece in question is skipping over a piece
    while (col_ctr != col_diff || row_ctr != row_diff) {
      let position =
          64 - start_row * 8 + -8 * row_ctr + (start_col - 1 + col_ctr);
      if (
          copy_squares[position].ascii != null &&
          copy_squares[position] != copy_squares[start]
      )
        return true;
      if (col_ctr != col_diff) {
        if (col_diff > 0) {
          ++col_ctr;
        } else {
          --col_ctr;
        }
      }
      if (row_ctr != row_diff) {
        if (row_diff > 0) {
          ++row_ctr;
        } else {
          --row_ctr;
        }
      }
    }
    return false;
  }

  // return true if pawn is not breaking any of its rules
  good_pawn(start, end, squares, passant_pos) {
    var passant = passant_pos == null ? this.state.passant_pos : passant_pos;
    var start_row = 8 - Math.floor(start / 8);
    var start_col = (start % 8) + 1;
    var end_row = 8 - Math.floor(end / 8);
    var end_col = (end % 8) + 1;
    var row_diff = end_row - start_row;
    var col_diff = end_col - start_col;
    const copy_squares = squares.slice();

    // only allow 2 space move if the pawn is in the start position
    if (row_diff == 2 || row_diff == -2) {
      if (copy_squares[start].player == "w" && (start < 48 || start > 55))
        return false;
      if (copy_squares[start].player == "b" && (start < 8 || start > 15))
        return false;
    }
    // cannot move up/down if there is a piece
    if (copy_squares[end].ascii != null) {
      if (col_diff == 0) return false;
    }
    // cannot move diagonally if there is no piece to capture UNLESS it's en passant
    if (row_diff == 1 && col_diff == 1) {
      // white going up and right
      if (copy_squares[end].ascii == null) {
        if (copy_squares[start + 1].ascii != "P" || passant != start + 1)
          return false;
      }
    } else if (row_diff == 1 && col_diff == -1) {
      // white going up and left
      if (copy_squares[end].ascii == null) {
        if (copy_squares[start - 1].ascii != "P" || passant != start - 1)
          return false;
      }
    } else if (row_diff == -1 && col_diff == 1) {
      // black going down and right
      if (copy_squares[end].ascii == null) {
        if (copy_squares[start + 1].ascii != "p" || passant != start + 1)
          return false;
      }
    } else if (row_diff == -1 && col_diff == -1) {
      // black going down and left
      if (copy_squares[end].ascii == null) {
        if (copy_squares[start - 1].ascii != "p" || passant != start - 1)
          return false;
      }
    }

    return true;
  }

  // return true if move from start to end is illegal
  invalid_move(start, end, squares, passant_pos) {
    const copy_squares = squares.slice();
    // if the piece is a bishop, queen, rook, or pawn,
    // it cannot skip over pieces
    var bqrpk =
        copy_squares[start].ascii.toLowerCase() == "r" ||
        copy_squares[start].ascii.toLowerCase() == "q" ||
        copy_squares[start].ascii.toLowerCase() == "b" ||
        copy_squares[start].ascii.toLowerCase() == "p" ||
        copy_squares[start].ascii.toLowerCase() == "k";
    let invalid =
        bqrpk == true && this.blockers_exist(start, end, copy_squares) == true;
    if (invalid) return invalid;
    // checking for certain rules regarding the pawn
    var pawn = copy_squares[start].ascii.toLowerCase() == "p";
    invalid =
        pawn == true &&
        this.good_pawn(start, end, copy_squares, passant_pos) == false;
    if (invalid) return invalid;
    // checking for if castling is allowed
    var king = copy_squares[start].ascii.toLowerCase() == "k";
    if (king && Math.abs(end - start) == 2)
      invalid = this.castling_allowed(start, end, copy_squares) == false;

    return invalid;
  }

  // returns true if there are any possible moves
  can_move_there(start, end, squares, passant_pos) {
    const copy_squares = squares.slice();
    if (start == end)
        // cannot move to the position you're already sitting in
      return false;

    // player cannot capture her own piece
    // and piece must be able to physically move from start to end
    var player = copy_squares[start].player;
    if (
        player == copy_squares[end].player ||
        copy_squares[start].can_move(start, end) == false
    )
      return false;
    // player cannot make an invalid move
    if (this.invalid_move(start, end, copy_squares, passant_pos) == true)
      return false;

    // cannot castle if in check
    var cant_castle =
        copy_squares[start].ascii == (player == "w" ? "k" : "K") &&
        Math.abs(end - start) == 2 &&
        this.in_check(player, copy_squares);
    if (cant_castle) return false;

    // king cannot castle through check
    if (
        copy_squares[start].ascii == (player == "w" ? "k" : "K") &&
        Math.abs(end - start) == 2
    ) {
      var delta_pos = end - start;
      const test_squares = squares.slice();
      test_squares[start + (delta_pos == 2 ? 1 : -1)] = test_squares[start];
      test_squares[start] = new filler_piece(null);
      if (this.in_check(player, test_squares)) return false;
    }

    // player cannot put or keep herself in check
    const check_squares = squares.slice();
    check_squares[end] = check_squares[start];
    check_squares[start] = new filler_piece(null);
    if (check_squares[end].ascii == "p" && end >= 0 && end <= 7) {
      check_squares[end] = new Queen("w");
    } else if (check_squares[end].ascii == "P" && end >= 56 && end <= 63) {
      check_squares[end] = new Queen("b");
    }
    if (this.in_check(player, check_squares) == true) return false;

    return true;
  }

  // returns true if player is in check
  in_check(player, squares) {
    let king = player == "w" ? "k" : "K";
    let position_of_king = null;
    const copy_squares = squares.slice();
    for (let i = 0; i < 64; i++) {
      if (copy_squares[i].ascii == king) {
        position_of_king = i;
        break;
      }
    }

    // traverse through the board and determine
    // any of the opponent's pieces can legally take the player's king
    for (let i = 0; i < 64; i++) {
      if (copy_squares[i].player != player) {
        if (
            copy_squares[i].can_move(i, position_of_king) == true &&
            this.invalid_move(i, position_of_king, copy_squares) == false
        )
          return true;
      }
    }
    return false;
  }

  // return true if player is in stalemate
  stalemate(player, squares) {
    if (this.in_check(player, squares)) return false;

    // if there is even only 1 way to move her piece,
    // the player is not in stalemate
    for (let i = 0; i < 64; i++) {
      if (squares[i].player == player) {
        for (let j = 0; j < 64; j++) {
          if (this.can_move_there(i, j, squares)) return false;
        }
      }
    }
    return true;
  }

  // return true if player is in checkmate
  checkmate(player, squares) {
    if (!this.in_check(player, squares)) return false;
    // if there is even only 1 way to move her piece,
    // the player is not in checkmate
    for (let i = 0; i < 64; i++) {
      if (squares[i].player == player) {
        for (let j = 0; j < 64; j++) {
          if (this.can_move_there(i, j, squares)) return false;
        }
      }
    }
    return true;
  }



  // Render the page
  render() {
    const row_nums = [];
    for (let i = 8; i > 0; i--) {
      row_nums.push(<Label key={i} value={i}/>);
    }
    const col_nums = [];
    for (let i = 1; i < 9; i++) {
      let letter;
      switch (i) {
        case 1:
          letter = "A";
          break;
        case 2:
          letter = "B";
          break;
        case 3:
          letter = "C";
          break;
        case 4:
          letter = "D";
          break;
        case 5:
          letter = "E";
          break;
        case 6:
          letter = "F";
          break;
        case 7:
          letter = "G";
          break;
        case 8:
          letter = "H";
          break;
      }
      col_nums.push(<Label key={letter} value={letter}/>);
    }

    const board = [];
    for (let i = 0; i < 8; i++) {
      const squareRows = [];
      for (let j = 0; j < 8; j++) {
        let square_corner = null;
        if (i == 0 && j == 0) {
          square_corner = " top_left_square ";
        } else if (i == 0 && j == 7) {
          square_corner = " top_right_square ";
        } else if (i == 7 && j == 0) {
          square_corner = " bottom_left_square ";
        } else if (i == 7 && j == 7) {
          square_corner = " bottom_right_square ";
        } else {
          square_corner = " ";
        }

        const copy_squares = this.state.squares.slice();
        let square_color = calc_squareColor(i, j, copy_squares);
        let square_cursor = "pointer";
        if (copy_squares[i * 8 + j].player != "w") square_cursor = "default";
        if (this.state.bot_running == 1 && !this.state.mated)
          square_cursor = "bot_running";
        if (this.state.mated) square_cursor = "default";
        if (this.state.history_num - 1 != this.state.turn_num)
          square_cursor = "not_allowed";

        squareRows.push(
            <Square
                key={i * 8 + j}
                value={copy_squares[i * 8 + j]}
                color={square_color}
                corner={square_corner}
                cursor={square_cursor}
                onClick={() => this.handleClick(i * 8 + j)}
            />
        );
      }
      board.push(<div key={i}>{squareRows}</div>);
    }

    let black_mated = this.checkmate("b", this.state.squares);
    let white_mated = this.checkmate("w", this.state.squares);
    let not_history =
        !(this.state.history_num - 1 != this.state.turn_num) &&
        !this.state.viewing_history;
    let stale =
        (this.stalemate("w", this.state.squares) && this.state.turn == "w") ||
        (this.stalemate("b", this.state.squares) && this.state.turn == "b");

    return (
        <div>
          {this.state.move_made && !this.state.capture_made && (
              <div>
                <audio
                    ref="audio_tag"
                    src="./sfx/Move.mp3"
                    controls
                    autoPlay
                    hidden
                />
                {" "}
              </div>
          )}
          {this.state.capture_made && not_history && (
              <div>
                <audio
                    ref="audio_tag"
                    src="./sfx/Capture.mp3"
                    controls
                    autoPlay
                    hidden
                />
                {" "}
              </div>
          )}
          {black_mated && not_history && (
              <div>
                <audio
                    ref="audio_tag"
                    src="./sfx/Black_Defeat.mp3"
                    controls
                    autoPlay
                    hidden
                />
                {" "}
              </div>
          )}
          {white_mated && not_history && (
              <div>
                <audio
                    ref="audio_tag"
                    src="./sfx/White_Defeat.mp3"
                    controls
                    autoPlay
                    hidden
                />
                {" "}
              </div>
          )}
          {stale && not_history && (
              <div>
                <audio
                    ref="audio_tag"
                    src="./sfx/Stalemate.mp3"
                    controls
                    autoPlay
                    hidden
                />
                {" "}
              </div>
          )}
          {this.state.check_flash &&
              !(this.state.history_num - 1 != this.state.turn_num) &&
              !this.state.just_clicked && (
                  <div>
                    {" "}
                    <audio
                        ref="audio_tag"
                        src="./sfx/Check_Flash.mp3"
                        controls
                        autoPlay
                        hidden
                    />
                    {" "}
                  </div>
              )}

          <div className="bounceInDown">
            <div className="left_screen bounceInDown">
              <div className="side_box">
                <div className="content">
                  <p className="header_font">CHEX629</p>
                  <p className="medium_font">
                    Play against our friendly bot!&nbsp;&nbsp;
                    <a href="./how_to_play.html" target="_blank">
                      How to Play
                    </a>
                  </p>
                </div>
              </div>

              <div className="side_box">
                <div className="content title">
                  <p className="header_2_font">Match Information</p>
                </div>

                <div className="wrapper">
                  <div className="player_box">
                    <p className="medium_font">White (You)</p>
                    {this.state.pieces_collected_by_white}
                  </div>
                  <div className="player_box black_player_color">
                    <p className="medium_font">Black (Bot)</p>
                    {this.state.pieces_collected_by_black}
                  </div>
                </div>
                <div className="wrapper">
                  {this.state.turn == "w" ? (
                      <div className="highlight_box"></div>
                  ) : (
                      <div className="highlight_box transparent"></div>
                  )}
                  {this.state.turn == "b" ? (
                      <div className="highlight_box"></div>
                  ) : (
                      <div className="highlight_box transparent"></div>
                  )}
                </div>

                <div className="button_wrapper">
                  <button
                      className="reset_button history"
                      onClick={() => this.viewHistory("back_atw")}
                  >
                    <p className="button_font">&lt;&lt;</p>
                  </button>
                  <button
                      className="reset_button history"
                      onClick={() => this.viewHistory("back")}
                  >
                    <p className="button_font">&lt;</p>
                  </button>
                  <button className="reset_button" onClick={() => this.reset()}>
                    <p className="button_font">Restart Game</p>
                  </button>
                  <button
                      className="reset_button history"
                      onClick={() => this.viewHistory("next")}
                  >
                    <p className="button_font">&gt;</p>
                  </button>
                  <button
                      className="reset_button history"
                      onClick={() => this.viewHistory("next_atw")}
                  >
                    <p className="button_font">&gt;&gt;</p>
                  </button>
                </div>

                <div className="mate_wrapper">
                  <p className="small_font">
                    {this.in_check("w", this.state.squares) &&
                    !this.checkmate("w", this.state.squares) == true
                        ? "You are in check!"
                        : ""}
                  </p>
                  <p className="small_font">
                    {this.in_check("b", this.state.squares) &&
                    !this.checkmate("b", this.state.squares) == true
                        ? "Black player is in check."
                        : ""}
                  </p>
                  <p className="small_font">
                    {this.checkmate("w", this.state.squares) == true
                        ? "You lost by checkmate."
                        : ""}
                  </p>
                  <p className="small_font">
                    {this.checkmate("b", this.state.squares) == true
                        ? "You won by checkmate!"
                        : ""}
                  </p>
                  <p className="small_font">
                    {(this.stalemate("w", this.state.squares) &&
                        this.state.turn == "w") == true
                        ? "You are in stalemate. Game over."
                        : ""}
                  </p>
                  <p className="small_font">
                    {(this.stalemate("b", this.state.squares) &&
                        this.state.turn == "b") == true
                        ? "Black is in stalemate. Game over."
                        : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="right_screen bounceInDown">
              <div className="row_label"> {row_nums} </div>
              <div className="table"> {board} </div>
              <div className="col_label"> {col_nums} </div>
            </div>
          </div>
        </div>
    );
  }
}



class Game extends React.Component {
  render() {
    return <Board />;
  }
}

// Piece Classes ========================================
class King {
  constructor(player) {
    this.player = player;
    this.highlight = 0;
    this.possible = 0;
    this.checked = 0;
    this.in_check = 0;
    this.icon =
      player == "w" ? (
        <img src="./images/white_king.png" className="piece"></img>
      ) : (
        <img src="./images/black_king.png" className="piece"></img>
      );
    this.ascii = player == "w" ? "k" : "K";
  }

  // function that defines piece's valid move shape
  can_move(start, end) {
    var start_row = 8 - Math.floor(start / 8);
    var start_col = (start % 8) + 1;
    var end_row = 8 - Math.floor(end / 8);
    var end_col = (end % 8) + 1;

    var row_diff = end_row - start_row;
    var col_diff = end_col - start_col;

    if (row_diff == 1 && col_diff == -1) {
      return true;
    } else if (row_diff == 1 && col_diff == 0) {
      return true;
    } else if (row_diff == 1 && col_diff == 1) {
      return true;
    } else if (row_diff == 0 && col_diff == 1) {
      return true;
    } else if (row_diff == -1 && col_diff == 1) {
      return true;
    } else if (row_diff == -1 && col_diff == 0) {
      return true;
    } else if (row_diff == -1 && col_diff == -1) {
      return true;
    } else if (row_diff == 0 && col_diff == -1) {
      return true;
    } else if (row_diff == 0 && col_diff == 2) {
      return true;
    } else if (row_diff == 0 && col_diff == -2) {
      return true;
    }
    return false;
  }
}
class Queen {
  constructor(player) {
    this.player = player;
    this.highlight = 0;
    this.possible = 0;
    this.icon =
      player == "w" ? (
        <img src="./images/white_queen.png" className="piece"></img>
      ) : (
        <img src="./images/black_queen.png" className="piece"></img>
      );
    this.ascii = player == "w" ? "q" : "Q";
  }

  // function that defines piece's valid move shape
  can_move(start, end) {
    var start_row = 8 - Math.floor(start / 8);
    var start_col = (start % 8) + 1;
    var end_row = 8 - Math.floor(end / 8);
    var end_col = (end % 8) + 1;

    var row_diff = end_row - start_row;
    var col_diff = end_col - start_col;

    if (row_diff > 0 && col_diff == 0) {
      return true;
    } else if (row_diff == 0 && col_diff > 0) {
      return true;
    } else if (row_diff < 0 && col_diff == 0) {
      return true;
    } else if (row_diff == 0 && col_diff < 0) {
      return true;
    } else if (row_diff == col_diff) {
      return true;
    } else if (row_diff == -col_diff) {
      return true;
    }
    return false;
  }
}
class Knight {
  constructor(player) {
    this.player = player;
    this.highlight = 0;
    this.possible = 0;
    this.icon =
      player == "w" ? (
        <img src="./images/white_knight.png" className="piece"></img>
      ) : (
        <img src="./images/black_knight.png" className="piece"></img>
      );
    this.ascii = player == "w" ? "n" : "N";
  }

  // function that defines piece's valid move shape
  can_move(start, end) {
    var start_row = 8 - Math.floor(start / 8);
    var start_col = (start % 8) + 1;
    var end_row = 8 - Math.floor(end / 8);
    var end_col = (end % 8) + 1;

    var row_diff = end_row - start_row;
    var col_diff = end_col - start_col;

    if (row_diff == 1 && col_diff == -2) {
      return true;
    } else if (row_diff == 2 && col_diff == -1) {
      return true;
    } else if (row_diff == 2 && col_diff == 1) {
      return true;
    } else if (row_diff == 1 && col_diff == 2) {
      return true;
    } else if (row_diff == -1 && col_diff == 2) {
      return true;
    } else if (row_diff == -2 && col_diff == 1) {
      return true;
    } else if (row_diff == -2 && col_diff == -1) {
      return true;
    } else if (row_diff == -1 && col_diff == -2) {
      return true;
    }
    return false;
  }
}
class Bishop {
  constructor(player) {
    this.player = player;
    this.highlight = 0;
    this.possible = 0;
    this.icon =
      player == "w" ? (
        <img src="./images/white_bishop.png" className="piece"></img>
      ) : (
        <img src="./images/black_bishop.png" className="piece"></img>
      );
    this.ascii = player == "w" ? "b" : "B";
  }

  // function that defines piece's valid move shape
  can_move(start, end) {
    var start_row = 8 - Math.floor(start / 8);
    var start_col = (start % 8) + 1;
    var end_row = 8 - Math.floor(end / 8);
    var end_col = (end % 8) + 1;

    var row_diff = end_row - start_row;
    var col_diff = end_col - start_col;

    if (row_diff == col_diff) {
      return true;
    } else if (row_diff == -col_diff) {
      return true;
    }
    return false;
  }
}
class Pawn {
  constructor(player) {
    this.player = player;
    this.highlight = 0;
    this.possible = 0;
    this.icon =
      player == "w" ? (
        <img src="./images/white_pawn.png" className="piece"></img>
      ) : (
        <img src="./images/black_pawn.png" className="piece"></img>
      );
    this.ascii = player == "w" ? "p" : "P";
  }

  // function that defines piece's valid move shape
  can_move(start, end) {
    var start_row = 8 - Math.floor(start / 8);
    var start_col = (start % 8) + 1;
    var end_row = 8 - Math.floor(end / 8);
    var end_col = (end % 8) + 1;

    var row_diff = end_row - start_row;
    var col_diff = end_col - start_col;

    if (this.player == "w") {
      if (col_diff == 0) {
        if (row_diff == 1 || row_diff == 2) return true;
      } else if (col_diff == -1 || col_diff == 1) {
        if (row_diff == 1) return true;
      }
    } else {
      if (col_diff == 0) {
        if (row_diff == -2 || row_diff == -1) return true;
      } else if (col_diff == -1 || col_diff == 1) {
        if (row_diff == -1) return true;
      }
    }
    return false;
  }
}
class Rook {
  constructor(player) {
    this.player = player;
    this.highlight = 0;
    this.possible = 0;
    this.icon =
        player == "w" ? (
            <img src="./images/white_rook.png" className="piece"></img>
        ) : (
            <img src="./images/black_rook.png" className="piece"></img>
        );
    this.ascii = player == "w" ? "r" : "R";
  }

  // function that defines piece's valid move shape
  can_move(start, end) {
    var start_row = 8 - Math.floor(start / 8);
    var start_col = (start % 8) + 1;
    var end_row = 8 - Math.floor(end / 8);
    var end_col = (end % 8) + 1;

    var row_diff = end_row - start_row;
    var col_diff = end_col - start_col;

    if (row_diff > 0 && col_diff == 0) {
      return true;
    } else if (row_diff == 0 && col_diff > 0) {
      return true;
    } else if (row_diff < 0 && col_diff == 0) {
      return true;
    } else if (row_diff == 0 && col_diff < 0) {
      return true;
    }
    return false;
  }
}
class filler_piece {
  constructor(player) {
    this.player = player;
    this.highlight = 0;
    this.possible = 0;
    this.icon = null;
    this.ascii = null;
  }

  // function that defines piece's valid move shape
  can_move(start, end) {
    return false;
  }
}

// Helper Function for Board Constructor =================
// initialize the chess board
function initializeBoard() {
  const squares = Array(64).fill(null);
  // black pawns
  for (let i = 8; i < 16; i++) {
    squares[i] = new Pawn("b");
  }
  // white pawns
  for (let i = 8 * 6; i < 8 * 6 + 8; i++) {
    squares[i] = new Pawn("w");
  }
  // black knights
  squares[1] = new Knight("b");
  squares[6] = new Knight("b");
  // white knights
  squares[56 + 1] = new Knight("w");
  squares[56 + 6] = new Knight("w");
  // black bishops
  squares[2] = new Bishop("b");
  squares[5] = new Bishop("b");
  // white bishops
  squares[56 + 2] = new Bishop("w");
  squares[56 + 5] = new Bishop("w");
  // black rooks
  squares[0] = new Rook("b");
  squares[7] = new Rook("b");
  // white rooks
  squares[56 + 0] = new Rook("w");
  squares[56 + 7] = new Rook("w");
  // black queen & king
  squares[3] = new Queen("b");
  squares[4] = new King("b");
  // white queen & king
  squares[56 + 3] = new Queen("w");
  squares[56 + 4] = new King("w");

  for (let i = 0; i < 64; i++) {
    if (squares[i] == null) squares[i] = new filler_piece(null);
  }

  return squares;
}

// Helper Functions for Render ===========================
// return the color of a square for the chess board
function calc_squareColor(i, j, squares) {
  let square_color =
      (isEven(i) && isEven(j)) || (!isEven(i) && !isEven(j))
          ? "white_square"
          : "black_square";
  if (squares[i * 8 + j].highlight == 1) {
    square_color =
        (isEven(i) && isEven(j)) || (!isEven(i) && !isEven(j))
            ? "selected_white_square"
            : "selected_black_square";
  }
  if (squares[i * 8 + j].possible == 1) {
    square_color =
        (isEven(i) && isEven(j)) || (!isEven(i) && !isEven(j))
            ? "highlighted_white_square"
            : "highlighted_black_square";
  }
  if (
      squares[i * 8 + j].ascii != null &&
      squares[i * 8 + j].ascii.toLowerCase() == "k"
  ) {
    if (squares[i * 8 + j].in_check == 1) {
      square_color =
          (isEven(i) && isEven(j)) || (!isEven(i) && !isEven(j))
              ? "in_check_square_white"
              : "in_check_square_black";
    }
    if (squares[i * 8 + j].checked >= 1) {
      square_color =
          squares[i * 8 + j].checked == 1 ? "checked_square" : "stale_square";
    }
  }
  return square_color;
}
// return labels for axes of the board
function Label(props) {
  return <button className={"label"}> {props.value} </button>;
}
// helper function to help generate arrays of pieces captured by a player
function Collected(props) {
  return <button className={"collected"}> {props.value.icon} </button>;
}

// Miscellaneous Functions ===============================
// return if value is even
function isEven(value) {
  return value % 2;
}

// =======================================================
ReactDOM.render(<Game />, document.getElementById("root"));
